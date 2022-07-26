# Deploy-Pages

This action is used to deploy [Actions artifacts][artifacts] to GitHub Pages.

## Scope

⚠️ Official support for building Pages with Actions is in public beta at the moment.

## Usage

See [action.yml](action.yml) for the various `inputs` this action supports.

To see real workflows making use of this action, see the [Pages starter-workflows][starter-workflows] that we publish.

This action expects an artifact to have been uploaded from the same workflow using [`actions/upload-pages-artifact`][upload-pages-artifact].

We recommend this action to be used in a dedicated job:

```yaml
jobs:
  # Build job
  build:
    # <Not provided for brevity>
    # At a minimum this job should upload artifacts using actions/upload-pages-artifact

  # Deploy job
  deploy:
    # Add a dependency to the build job
    needs: build

    # Grant GITHUB_TOKEN the permissions required to make a Pages deployment
    permissions:
      pages: write      # to deploy to Pages
      id-token: write   # to verify the deployment originates from an appropriate source

    # Deploy to the github-pages environment
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    # Specify runner + deployment step
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v1
```

# Security considerations

There are a few important considerations to be aware of:

1. The artifact being deployed must have been uploaded in a previous step, either in the same job or a separate job that doesn't execute until the upload is complete.

2. The deployment step must at minimum have the following permissions:
   - `pages: write`
   - `id-token: write`

3. The deployment must target a `github-pages` environment (you may use a different environment name but we don't recommend it)

4. If your Pages site is using a source branch, the deployment must originate from this source branch unless [your environment is protected][environment-protection] in which case the environment protection rules take precedence over the source branch rule

5. If your Pages site is using GitHub Actions as the source, while not required we highly recommend you also [protect your environment][environment-protection] (we do it by default for you)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

<!-- references -->
[starter-workflows]: https://github.com/actions/starter-workflows/tree/main/pages
[upload-pages-artifact]: https://github.com/actions/upload-pages-artifact
[artifacts]: https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
[environment-protection]: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#environment-protection-rules