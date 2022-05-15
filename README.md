# Deploy-Pages

This deploys artifacts to GitHub Pages.

# Scope

⚠️ Official support for building Pages with Actions is in public beta at the moment. The scope is currently limited to **public repositories only**.

# Example Workflow

```yaml
# this can be anything
name: GitHub Pages

permissions:
  contents: read
  # these permissions are required for the action to work properly
  pages: write
  id-token: write

# this can be anything 
on:
  push:
    branches: [main]

jobs:
  deploy:
    # this can be anything
    runs-on: ubuntu-20.04
    environment:
      # links this workflow to the deployments page on your repository
      name: github-pages
      # attaches the deployed URL to this job on the workflow summary
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      # - name: Checkout
      #   uses: actions/checkout@v2
      # ... do whatever you need to do to build your website

      - name: Create Archive
        # use one of these commands as inspiration, and feel free to name the .tar file whatever you want
        # change 'public' to your build output folder (such as _site or build).
        # note that you should *not* pass the `-z` option to compress the .tar archive.

        # this one will log no output
        run: tar -cf artifact.tar --cd public .

        # this one will log output similar to `ls -l` for each file included in the .tar file
        # also, it will include the current commit SHA in the artifact filename,
        # which makes it easier to tell the artifacts apart if you manually download several.
        run: tar -cvvf github-pages-${{ github.sha }}.tar -C public .

        # this one is the same as the above one, except it uses long arguments for clarity.
        run: tar -vv --create --file gh-pages-${{ github.sha }}.tar  --directory public .

      - name: Upload Archive
        uses: actions/upload-artifact@v3
        with:
          # This name can be anything. The deploy-pages action currently
          # looks for the first artifact to be uploaded
          name: Built Website
          # this path must match the one given to `tar` above.
          path: gh-pages-${{ github.sha }}.tar

      - name: Deploy to GitHub Pages
        id: deployment # this needs to match the ID referenced in environment.url above
        uses: actions/deploy-pages@v1
        with:
          emit_telemetry: false # telemetry is not currently supported for custom builds
```

For more information about the other inputs available, take a look at the [action.yml file](https://github.com/actions/deploy-pages/blob/main/action.yml) in this repository.

In order for dpeloys to work, you’ll need to:

- set up an empty `gh-pages` branch
- configure GitHub Pages to deploy from the `gh-pages` branch
- go to Environments → `github-pages` in repository settings and change the “Deployment branches” setting to “Selected branches,” but don’t select any brnaches. The “All branches” setting won’t work.


# License

The scripts and documentation in this project are released under the [MIT License](LICENSE).
