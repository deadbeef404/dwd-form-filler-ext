# Create production and dev builds.
#
# The main difference between the builds is the color of the icon.
# This makes it easy to differentiate which one is which the Chrome toolbar.
rm -rf build-prod
rm -rf build-dev
mkdir build-prod
mkdir build-dev

# Create production build
cp -r LICENSE.md README.md background.html bootstrap javascripts manifest.json popup.html build-prod/

# Create dev build, from prod build.
cp -r build-prod/* build-dev
sed -i '' 's/"DWD Form Filler"/"DWD Form Filler (Dev)"/g' ./build-dev/manifest.json

# Add the correct iages.
cp -r images-prod build-prod/images
cp -r images-dev build-dev/images
