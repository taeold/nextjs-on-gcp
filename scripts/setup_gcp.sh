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

echo "Setting up project $PROJECT_ID in region $REGION"

echo "========================================================="
echo "Checking Billing Info"
echo "========================================================="
if ! gcloud billing projects describe $PROJECT_ID | grep "billingEnabled: true" > /dev/null 2>&1; then
    echo "Error: Billing is not enabled for project $PROJECT_ID"
    echo "Please enable billing for this project and try again."
    echo "https://cloud.google.com/billing/docs/how-to/modify-project"
    exit 1
fi
echo "Billing is enabled for project $PROJECT_ID"


echo
echo "========================================================="
echo "Enabling Required Google Cloud Platfrom APIs"
echo "========================================================="
exe gcloud services enable run.googleapis.com --project $PROJECT_ID
exe gcloud services enable cloudbuild.googleapis.com --project $PROJECT_ID
exe gcloud services enable firestore.googleapis.com --project $PROJECT_ID


echo
echo "========================================================="
echo "Creating Firestore instance"
echo "========================================================="
if qexe gcloud firestore databases describe --project $PROJECT_ID; then
    echo "Skipping. Firestore instance already exists"
else
    FIRESTORE_REGION=$REGION
    if [[ "$REGION" == "us-central1" || "$REGION" == "us-central2" ]]; then
        # Use multi-region for us-central1 and us-central2
        echo "Creating Firestore instance in multi-region nam5 instead of $REGION"
        FIRESTORE_REGION="nam5"
    fi
    exe gcloud firestore databases create --location $FIRESTORE_REGION --project $PROJECT_ID
fi
# echo
# echo "========================================================="
# echo "Enabling Required Firebase APIs"
# echo "========================================================="
# exe gcloud services enable firebase.googleapis.com --project $PROJECT_ID


# echo
# echo "========================================================="
# echo "Adding Firebase to Google Cloud Project"
# echo "========================================================="
# if qexe curl https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID \
#     -H "Authorization: Bearer $(gcloud auth print-access-token --project $PROJECT_ID)" \
#     -H "x-goog-user-project: $PROJECT_ID"; then
#     echo "Skipping. Firebase already added to project $PROJECT_ID"
# else
#     echo "Adding Firebase to project $PROJECT_ID"
#     exe curl -X POST https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID:addFirebase \
#         -H "Authorization: Bearer $(gcloud auth print-access-token --project $PROJECT_ID)" \
#         -H "x-goog-user-project: $PROJECT_ID";
# fi



echo
echo "========================================================="
echo "Setting Up Google Cloud Artifact Registry"
echo "========================================================="
REPO_NAME="demo"
if qexe gcloud artifacts repositories describe $REPO_NAME --location=$REGION --project=$PROJECT_ID; then
    echo "Skipping. Repository with name ${REPO_NAME} in ${REGION} already exists"
else
    echo "Creating repository ${REPO_NAME} in ${REGION}:"
    exe gcloud artifacts repositories create demo --repository-format=docker --location=$REGION --project=$PROJECT_ID
fi

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
echo "Building and Deploying the Application to Cloud Run"
echo "========================================================="
exe gcloud builds submit \
    --project $PROJECT_ID \
    --region $REGION \
    --substitutions _REPO_NAME=$REPO_NAME \
    .
