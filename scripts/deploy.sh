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

qexe() { "$@" > /dev/null 2>&1 ; }

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

echo "Deploying to project $PROJECT_ID in region $REGION"

echo
echo "========================================================="
echo "Checking required tools"
echo "========================================================="
if ! qexe which gcloud; then
    echo "Error: gcloud is not installed"
    echo "Visit https://cloud.google.com/sdk/docs/install for installation instructions."
    exit 1
else
    echo "gcloud is installed"
fi

echo
echo "========================================================="
echo "Building and Deploying the Application to Cloud Run"
echo "========================================================="
DEFAULT_DATABASE="$PROJECT_ID-default-rtdb"
REPO_NAME=demo
exe gcloud builds submit \
    --project $PROJECT_ID \
    --region $REGION \
    --substitutions _REPO_NAME=$REPO_NAME,_DATABASE_URL="http://$DEFAULT_DATABASE.firebaseio.com" \
    .
