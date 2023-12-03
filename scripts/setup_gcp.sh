#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ID=""
REGION=""

usage() {
    echo "Usage: $0 -p <PROJECT_ID> -r <REGION>"
    echo "  -p, --project <PROJECT_ID> : ID of the Google Cloud Platform project"
    echo "  -r, --region <PROJECT_ID> : Region to deploy the application to"
    exit 1
}

exe() { echo "\$ $@" ; "$@" ; }

# Parse the command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--project)
            PROJECT_ID="$2"
            shift # remove the current argument
            shift # remove the argument value
            ;;
        -r|--region)
            REGION="$2"
            shift
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown argument: $1"
            usage
            ;;
    esac
done

# Check if the required arguments are provided
if [[ -z "$PROJECT_ID" || -z "$REGION" ]]; then
    echo "Error: Missing required arguments."
    usage
fi

echo "Setting up project $PROJECT_ID in region $REGION"

echo
echo "========================================================="
echo "Enabling required Google Cloud Platfrom APIs"
echo "========================================================="
exe gcloud services enable run.googleapis.com --project $PROJECT_ID
exe gcloud services enable cloudbuild.googleapis.com --project $PROJECT_ID

echo
echo "========================================================="
echo "Setting up Google Cloud Artifact Registry"
echo "========================================================="
REPO_NAME="demo"
if gcloud artifacts repositories describe $REPO_NAME --location=$REGION --project=$PROJECT_ID > /dev/null 2>&1; then
    echo "Skipping. Repository with name ${REPO_NAME} in ${REGION} already exists"
else
    echo "Creating repository ${REPO_NAME} in ${REGION}:"
    exe gcloud artifacts repositories create demo --repository-format=docker --location=$REGION --project=$PROJECT_ID
fi

# echo
# echo "========================================================="
# echo "Preparing Firebase Builder Image"
# echo "========================================================="
# FB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/firebase"
# if gcloud artifacts docker images describe $FB_IMAGE > /dev/null 2>&1; then
#     echo "Skipping. Firebase builder image $FB_IMAGE already exists"
# else
#     echo "Building and publishing image $FB_IMAGE"
#     exe gcloud builds submit --config $SCRIPT_DIR/cloudbuild.firebase.yaml \
#         --project $PROJECT_ID \
#         --region $REGION \
#         --substitutions _REPO_NAME=$REPO_NAME \
#         .
# fi

echo
echo "========================================================="
echo "Preparing Cloud Build Service Account"
echo "========================================================="
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
echo "Granting the Cloud Run Admin role to the Cloud Build service account:"
exe gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
    --role=roles/run.admin
echo
echo "Granting the IAM Service Account User role to the Cloud Build service account for the Cloud Run runtime service account:"
exe gcloud iam service-accounts add-iam-policy-binding \
    $PROJECT_NUMBER-compute@developer.gserviceaccount.com \
    --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
    --role=roles/iam.serviceAccountUser

echo
echo "========================================================="
echo "Building and deploying the application to Cloud Run"
echo "========================================================="
exe gcloud builds submit \
    --project $PROJECT_ID \
    --region $REGION \
    --substitutions _REPO_NAME=$REPO_NAME \
    .
