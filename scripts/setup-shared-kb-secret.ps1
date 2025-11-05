# PowerShell script to create and configure toto-bo-service-account secret
# This script:
# 1. Creates the secret in Google Secret Manager
# 2. Adds the service account JSON as the secret value
# 3. Grants access to Firebase App Hosting backend

param(
    [string]$ProjectId = "toto-ai-hub",
    [string]$SecretName = "toto-bo-service-account",
    [string]$BackendName = "toto-ai-hub-backend",
    [string]$ServiceAccountFile = "..\toto-bo\toto-bo-firebase-adminsdk-fbsvc-138f229598.json"
)

Write-Host "🔐 Setting up Shared KB Secret for toto-ai-hub" -ForegroundColor Cyan
Write-Host ""

# Check if service account file exists
if (-not (Test-Path $ServiceAccountFile)) {
    Write-Host "❌ Service account file not found: $ServiceAccountFile" -ForegroundColor Red
    Write-Host "   Please ensure the file exists or provide the correct path" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found service account file: $ServiceAccountFile" -ForegroundColor Green

# Read and minify the JSON (convert to single-line string)
Write-Host "📄 Reading service account JSON..." -ForegroundColor Cyan
$serviceAccountJson = Get-Content $ServiceAccountFile -Raw | ConvertFrom-Json | ConvertTo-Json -Compress
Write-Host "✅ JSON loaded and minified" -ForegroundColor Green

# Set the project
Write-Host ""
Write-Host "🔧 Setting GCP project to: $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set GCP project" -ForegroundColor Red
    exit 1
}

# Check if secret already exists
Write-Host ""
Write-Host "🔍 Checking if secret '$SecretName' already exists..." -ForegroundColor Cyan
$secretExists = $false
try {
    $null = gcloud secrets describe $SecretName --project=$ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $secretExists = $true
    }
} catch {
    $secretExists = $false
}

if ($secretExists) {
    Write-Host "⚠️  Secret '$SecretName' already exists" -ForegroundColor Yellow
    $update = Read-Host "Do you want to update it? (y/n)"
    if ($update -eq "y" -or $update -eq "Y") {
        Write-Host "📝 Updating secret value..." -ForegroundColor Cyan
        echo $serviceAccountJson | gcloud secrets versions add $SecretName --data-file=- --project=$ProjectId
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Secret updated successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to update secret" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⏭️  Skipping secret update" -ForegroundColor Yellow
    }
} else {
    # Create the secret
    Write-Host "📝 Creating new secret '$SecretName'..." -ForegroundColor Cyan
    echo $serviceAccountJson | gcloud secrets create $SecretName --data-file=- --project=$ProjectId
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create secret" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Secret created successfully" -ForegroundColor Green
}

# Grant access to App Hosting backend
Write-Host ""
Write-Host "🔐 Granting access to Firebase App Hosting backend..." -ForegroundColor Cyan
Write-Host "   Backend: $BackendName" -ForegroundColor Gray
Write-Host "   Project: $ProjectId" -ForegroundColor Gray

# Try Firebase CLI first
Write-Host ""
Write-Host "📝 Attempting to grant access via Firebase CLI..." -ForegroundColor Cyan
firebase apphosting:secrets:grantaccess $SecretName --backend $BackendName --project $ProjectId
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Access granted via Firebase CLI" -ForegroundColor Green
} else {
    Write-Host "⚠️  Firebase CLI command failed, trying gcloud..." -ForegroundColor Yellow
    
    # Alternative: Grant access via IAM
    Write-Host ""
    Write-Host "📝 Granting access via gcloud IAM..." -ForegroundColor Cyan
    
    # Get the App Hosting service account
    $serviceAccount = "service-$((gcloud projects describe $ProjectId --format='value(projectNumber)'))@gcp-sa-firebaseapphosting.iam.gserviceaccount.com"
    Write-Host "   Service Account: $serviceAccount" -ForegroundColor Gray
    
    gcloud secrets add-iam-policy-binding $SecretName `
        --member="serviceAccount:$serviceAccount" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Access granted via gcloud IAM" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to grant access. Please grant manually:" -ForegroundColor Red
        Write-Host ""
        Write-Host "   gcloud secrets add-iam-policy-binding $SecretName \`" -ForegroundColor Yellow
        Write-Host "       --member='serviceAccount:$serviceAccount' \`" -ForegroundColor Yellow
        Write-Host "       --role='roles/secretmanager.secretAccessor' \`" -ForegroundColor Yellow
        Write-Host "       --project=$ProjectId" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Secret setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "   Secret Name: $SecretName" -ForegroundColor White
Write-Host "   Project: $ProjectId" -ForegroundColor White
Write-Host "   Backend: $BackendName" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Verify the secret:" -ForegroundColor Cyan
Write-Host "   gcloud secrets describe $SecretName --project=$ProjectId" -ForegroundColor Gray
Write-Host ""
Write-Host "🔍 Check IAM permissions:" -ForegroundColor Cyan
Write-Host "   gcloud secrets get-iam-policy $SecretName --project=$ProjectId" -ForegroundColor Gray

