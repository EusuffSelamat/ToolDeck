#!/bin/bash

# Navigate to the directory where this script is located
cd "$(dirname "$0")" || exit

echo "========================================"
echo " Force Push to GitHub Repository (PAT)  "
echo "========================================"

# Ask for GitHub username and repository name
read -p "Enter your GitHub username: " GITHUB_USERNAME
read -p "Enter the name of the EXISTING repository: " REPO_NAME

# Securely ask for the Personal Access Token (typing will be hidden)
read -s -p "Enter your GitHub Personal Access Token: " GITHUB_TOKEN
echo "" # Print a newline

# Basic validation
if [ -z "$GITHUB_USERNAME" ] || [ -z "$REPO_NAME" ] || [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: Username, repository name, and token cannot be empty."
    exit 1
fi

# Construct the remote URL with the token embedded
REPO_URL="https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

# 1. Initialize Git locally if it hasn't been initialized already
if [ ! -d ".git" ]; then
    echo "Initializing local Git repository..."
    git init
else
    echo "Local Git repository already initialized."
fi

# 2. Add all files and folders
echo "Adding files to staging area..."
git add .

# 3. Commit the files
echo "Committing files..."
git commit -m "Automated upload: $(date +"%Y-%m-%d %H:%M:%S")" || echo "No new changes to commit."

# 4. Set the branch name to 'main'
echo "Setting branch to 'main'..."
git branch -M main

# 5. Link to the existing remote repository using the authenticated URL
if git remote get-url origin &> /dev/null; then
    echo "Updating remote origin with authenticated URL..."
    git remote set-url origin "$REPO_URL"
else
    echo "Adding remote origin..."
    git remote add origin "$REPO_URL"
fi

# 6. Force Push the files to GitHub
# The -f flag overwrites the remote repo to perfectly match your local folder
echo "Force pushing files to GitHub..."
git push -u -f origin main

echo "========================================"
echo "Process complete! Your GitHub repo now perfectly matches your local folder."