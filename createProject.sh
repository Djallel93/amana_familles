#!/bin/bash

# Setup script for Family Delivery Management System
# This creates the complete folder structure and empty files

echo "🚀 Setting up Family Delivery Management System..."
echo ""

# Create main project folder
PROJECT_DIR="Google_app_script"
echo "📁 Creating project directory: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR" || exit 1

# Create folder structure
echo "📁 Creating folder structure..."
mkdir -p src/core
mkdir -p src/api
mkdir -p src/handlers
mkdir -p src/services
mkdir -p src/ui
mkdir -p assets/css
mkdir -p views/dialogs
mkdir -p tests

echo "✅ Folder structure created!"
echo ""

# Create files in src/core/
echo "📄 Creating core files..."
touch src/core/config.js
touch src/core/utils.js

# Create files in src/services/
echo "📄 Creating service files..."
touch src/services/geoService.js
touch src/services/driveService.js
touch src/services/contactService.js

# Create files in src/handlers/
echo "📄 Creating handler files..."
touch src/handlers/formHandler.js
touch src/handlers/editHandler.js

# Create files in src/ui/
echo "📄 Creating UI files..."
touch src/ui/menu.js
touch src/ui/helpers.js

# Create files in src/api/
echo "📄 Creating API files..."
touch src/api/familyApiHandler.js

# Create files in assets/
echo "📄 Creating asset files..."
touch assets/css/styles.html

# Create files in views/
echo "📄 Creating view files..."
touch views/dialogs/manualEntry.html

# Create files in tests/
echo "📄 Creating test files..."
touch tests/tests.js

# Create root level files
echo "📄 Creating root files..."
touch appsscript.json
touch .claspignore

# Go back to parent directory
cd ..

# Create documentation files
echo "📄 Creating documentation files..."
touch README.md
touch SETUP_CHECKLIST.md
touch PROJECT_STRUCTURE.md

echo ""
echo "✅ All files created successfully!"
echo ""
echo "📊 Project structure:"
echo ""

# Display tree structure (if tree command exists)
if command -v tree &> /dev/null; then
    tree -L 4 "$PROJECT_DIR"
else
    echo "└── $PROJECT_DIR/"
    echo "    ├── appsscript.json"
    echo "    ├── .claspignore"
    echo "    ├── assets/"
    echo "    │   └── css/"
    echo "    │       └── styles.html"
    echo "    ├── src/"
    echo "    │   ├── api/"
    echo "    │   │   └── familyApiHandler.js"
    echo "    │   ├── core/"
    echo "    │   │   ├── config.js"
    echo "    │   │   └── utils.js"
    echo "    │   ├── handlers/"
    echo "    │   │   ├── editHandler.js"
    echo "    │   │   └── formHandler.js"
    echo "    │   ├── services/"
    echo "    │   │   ├── contactService.js"
    echo "    │   │   ├── driveService.js"
    echo "    │   │   └── geoService.js"
    echo "    │   └── ui/"
    echo "    │       ├── helpers.js"
    echo "    │       └── menu.js"
    echo "    ├── tests/"
    echo "    │   └── tests.js"
    echo "    └── views/"
    echo "        └── dialogs/"
    echo "            └── manualEntry.html"
fi

echo ""
echo "📝 File count:"
echo "   - Source files: 10"
echo "   - View files: 1"
echo "   - Asset files: 1"
echo "   - Test files: 1"
echo "   - Config files: 2"
echo "   - Total: 15 files"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Copy/paste code into each file"
echo "   2. Run: cd $PROJECT_DIR"
echo "   3. Run: clasp create --type sheets"
echo "   4. Run: clasp push"
echo ""
echo "💡 Tip: Use 'clasp open' to open the project in your browser"
echo ""