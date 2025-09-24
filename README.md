# Setup the project

    $ npm install

## Setup worktree to publish to Github pages

    $ git worktree add gh-pages/ gh-pages

# Run the project

## Download current HelloAsso data

    $ npm run acsdata

## Build the all-in-one encrypted web page

    $ npm run build

## Publish to Github pages

    $ cp dist/index.html gh-pages/index.html
    $ cd gh-pages/
    $ git commit -a -m "Update index.html"
    $ git push origin gh-pages
