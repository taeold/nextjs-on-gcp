const path = require("path");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getDatabase, ServerValue } = require("firebase-admin/database");

function debug(...args) {
  if (
    process.env.NODE_ENV !== "production" ||
    !!process.env.FIREBASE_DATABASE_EMULATOR_HOST
  ) {
    console.debug("RTDBCache: ", ...args);
  }
}

function warn(...args) {
  console.warn("RTDBCache: ", ...args);
}

function error(...args) {
  console.error("RTDBCache: ", ...args);
}

const invalidChars = /[.\$\#\[\]\/\x00-\x1F\x7F]/g;

function encodeTag(tag) {
  return encodeURIComponent(tag);
}

function decodeTag(tag) {
  return decodeURIComponent(tag);
}

function sanitizeKey(key) {
  return encodeURIComponent(key).replace(invalidChars, "_");
}

function lossyDesanitizeKey(key) {
  return decodeURIComponent(key).replace(/_/g, "/");
}

class RTDBCache {
  constructor(_ctx) {
    if (getApps().length === 0) {
      initializeApp();
    }
    this.rtdb = getDatabase();
    this.buildId = process.env.BUILD_ID ?? "deadbeef";
    this.publicUrl = process.env.PUBLIC_URL ?? "http://localhost:3000";
  }

  async get(key, context) {
    debug("get", { key, context });
    const isFetchCache =
      typeof context === "object"
        ? context.fetchCache || context.kindHint === "fetch"
        : context;
    return isFetchCache
      ? this.getFetchCache(key, context)
      : this.getIncrementalCache(key);
  }

  async set(key, data, ctx) {
    debug("set", { key, ctx });
    if (data?.kind === "ROUTE") {
      const { body, status, headers } = data;
      this.putRtdbValue(
        key,
        data.kind,
        JSON.stringify({
          type: "route",
          body: body.toString("utf8"),
          meta: {
            status,
            headers,
          },
        }),
      );
    } else if (data?.kind === "PAGE") {
      const { html, pageData } = data;
      const isAppPath = typeof pageData === "string";
      this.putRtdbValue(
        key,
        data.kind,
        JSON.stringify({
          type: isAppPath ? "app" : "page",
          html,
          rsc: isAppPath ? pageData : undefined,
          json: isAppPath ? undefined : pageData,
          meta: { status: data.status, headers: data.headers },
        }),
      );
    } else if (data?.kind === "FETCH") {
      await this.putRtdbValue(key, data.kind, JSON.stringify(data));
    } else if (data?.kind === "REDIRECT") {
      await this.putRtdbValue(
        key,
        data.kind,
        JSON.stringify({
          type: "redirect",
          props: data.props,
        }),
      );
    } else if (data === null || data === undefined) {
      await this.removeRtdbValue(key);
    }

    const derivedTags =
      data?.kind === "FETCH"
        ? ctx.tags ?? ctx.softTags ?? []
        : data?.kind === "PAGE"
          ? data.headers?.["x-next-cache-tags"]?.split(",") ?? []
          : [];
    debug("derivedTags", derivedTags);

    const storedTags = await this.getTagsByPath(key, data.kind);
    const tagsToWrite = derivedTags.filter((tag) => !storedTags.includes(tag));
    if (derivedTags.length > 0) {
      await this.setTags(key, data.kind, tagsToWrite);
      await this.refreshTags(
        tagsToWrite,
        data.kind !== "FETCH" ? key : undefined,
      );
    }
  }

  async revalidateTag(tag) {
    debug("revalidateTag", tag);
    await this.refreshTags([tag]);
    const paths = await this.getPathsByTag(tag);
    if (paths.length > 0) {
      debug("PURGE paths", paths);
      for (const path of paths) {
        const targetUrl = `${this.publicUrl}${path}`;
        debug("PURGING", targetUrl);
        try {
          await fetch(targetUrl, { method: "PURGE" });
        } catch (error) {
          debug("revalidateTag: Failed to purge path", path, error);
        }
      }
    }
  }

  async getFetchCache(key, context) {
    debug("get fetch cache", { key, context });
    try {
      const value = await this.getRtdbValue(key, "FETCH");
      debug("get fetch cache value", { value });

      if (value === null) return null;

      const hasStaleTags = await this.hasStaleTags(
        key,
        "FETCH",
        value.lastModified,
        context.softTags,
      );
      const lastModified = hasStaleTags ? -1 : value.lastModified ?? Date.now();
      debug("get fetch cache last validation status", {
        hasStaleTags,
        lastModified,
        value: value.lastModified,
      });

      // If some tags are stale we need to force revalidation
      if (lastModified === -1) {
        debug("stale tags, forcing revalidation");
        return null;
      }

      return {
        lastModified,
        value: JSON.parse(value.data),
      };
    } catch (e) {
      error("getFetchCache: Failed to get fetch cache", e);
      return null;
    }
  }

  async getIncrementalCache(key) {
    try {
      const value = await this.getRtdbValue(key, "cache");

      if (!value) {
        return null;
      }

      const hasTags = await this.hasStaleTags(key, "cache", value.lastModified);
      const lastModified = hasTags ? -1 : value?.lastModified ?? Date.now();

      if (lastModified === -1) {
        return null;
      }

      const cacheData = JSON.parse(value.data);

      if (cacheData.type === "route") {
        return {
          lastModified,
          value: {
            kind: "ROUTE",
            body: cacheData.body,
            status: cacheData.meta?.status,
            headers: cacheData.meta?.headers,
          },
        };
      } else if (cacheData.type === "page" || cacheData.type === "app") {
        return {
          lastModified,
          value: {
            kind: "PAGE",
            html: cacheData.html,
            pageData:
              cacheData.type === "page" ? cacheData.json : cacheData.rsc,
            status: cacheData.meta?.status,
            headers: cacheData.meta?.headers,
          },
        };
      } else if (cacheData.type === "redirect") {
        return {
          lastModified,
          value: {
            kind: "REDIRECT",
            props: cacheData.props,
          },
        };
      } else {
        warn("getCache: Unknown cache type", cacheData);
        return null;
      }
    } catch (e) {
      error("getCache: Failed to get body cache", e);
      return null;
    }
  }

  async getTagsByPath(path, extension) {
    debug("getTagsByPath", path, extension);
    try {
      const snapshot = await this.rtdb
        .ref(this.buildRef(path, extension))
        .child("tags")
        .get();
      const val = snapshot.val();
      const escapedTags = Object.keys(val ?? {});
      const tags = escapedTags.map((tag) => decodeTag(tag));
      debug("tags for path", path, escapedTags);
      return tags;
    } catch (e) {
      error("getTagsByPath: Failed to get tags by path", e);
      return [];
    }
  }
  async getPathsByTag(tag) {
    debug("getPathsByTag", tag);
    try {
      const snapshot = await this.rtdb
        .ref(this.buildTagRef(tag))
        .child("paths")
        .get();
      const val = snapshot.val();
      const sanitizePaths = Object.keys(val ?? {});
      const paths = sanitizePaths.map((path) => lossyDesanitizeKey(path));
      debug("paths for tag", tag, paths);
      return paths;
    } catch (e) {
      error("getPathsByTag: Failed to get tags by path", e);
      return [];
    }
  }

  async hasStaleTags(key, extension, lastModified, softTags = []) {
    debug("hasStaleTags", { key, extension, lastModified, softTags });
    try {
      const snapshot = await this.rtdb
        .ref(this.buildRef(key, extension))
        .child("tags")
        .get();
      const escapedTags = Object.keys(snapshot.val() ?? {});
      const tags = [...escapedTags.map((tag) => decodeTag(tag)), ...softTags];

      debug("check stalenss of tags against last modified", {
        tags,
        lastModified,
      });

      // Filter out tags whose last modified is greater than the last revalidation
      for (const tag of tags) {
        const tagVal = await this.getByTag(tag);
        debug("checking staleness of tag", tag, tagVal);
        if (tagVal !== null) {
          const { revalidatedAt } = tagVal;
          if (lastModified < revalidatedAt) {
            debug("found stale tag", {
              tag,
              lastModified,
              revalidatedAt,
            });
            return true;
          }
        }
        debug("tag is not stale", { tag, lastModified, tagVal });
      }
      return false;
    } catch (e) {
      error("hasStaleTags: Failed to get revalidated tags", e);
      return false;
    }
  }

  async getByTag(tag) {
    debug("getByTag", tag);
    try {
      const snapshot = await this.rtdb.ref(this.buildTagRef(tag)).get();
      return snapshot.val();
    } catch (e) {
      error("getByTag: Failed to get by tag", e);
      return [];
    }
  }

  async setTags(key, extension, tags) {
    const tagsDict = tags.reduce((acc, tag) => {
      acc[encodeTag(tag)] = true;
      return acc;
    }, {});
    await this.rtdb
      .ref(this.buildRef(key, extension))
      .child("tags")
      .update(tagsDict);
  }

  async refreshTags(tags, path) {
    try {
      const promises = tags.map(async (tag) => {
        await this.rtdb
          .ref(this.buildTagRef(tag))
          .update(this.buildTagValue(tag));
        if (path) {
          await this.rtdb
            .ref(this.buildTagRef(tag))
            .child("paths")
            .update({ [sanitizeKey(path)]: true });
        }
      });
      await Promise.all(promises);
    } catch (e) {
      error("Failed to refresh tags", e);
    }
  }

  buildTagValue() {
    return {
      revalidatedAt: ServerValue.TIMESTAMP,
    };
  }

  sanitizeKey(key) {
    return encodeURIComponent(key).replace(invalidChars, "_");
  }

  buildRef(key, extension) {
    return path.posix.join(
      this.buildId,
      extension === "FETCH" ? "fetch" : "",
      sanitizeKey(key),
    );
  }

  buildTagRef(tag) {
    const escapedTag = this.sanitizeKey(tag);
    return path.posix.join(this.buildId, "tags", escapedTag);
  }

  async getRtdbValue(key, extension) {
    try {
      const snapshot = await this.rtdb.ref(this.buildRef(key, extension)).get();
      const result = snapshot.val();
      return result;
    } catch (e) {
      warn("This error can usually be ignored : ", e);
      return {};
    }
  }

  async putRtdbValue(key, extension, data) {
    await this.rtdb.ref(this.buildRef(key, extension)).update({
      data,
      extension,
      lastModified: ServerValue.TIMESTAMP,
    });
  }

  async removeRtdbValue(key) {
    try {
      await this.rtdb.ref(this.buildRef(key)).remove();
    } catch (e) {
      error("Failed to delete cache", e);
    }
  }
}

module.exports = RTDBCache;
