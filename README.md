# deploy-pages 🚀

[![Release](https://img.shields.io/github/v/release/actions/deploy-pages?label=Release&logo=github)](https://github.com/actions/deploy-pages/releases/latest) [![Linting](https://img.shields.io/github/actions/workflow/status/actions/deploy-pages/check-linter.yml?label=Linting&logo=github)](https://github.com/actions/deploy-pages/actions/workflows/check-linter.yml) [![Formatting](https://img.shields.io/github/actions/workflow/status/actions/deploy-pages/check-formatting.yml?label=Formatting&logo=github)](https://github.com/actions/deploy-pages/actions/workflows/check-formatting.yml) [![Tests](https://img.shields.io/github/actions/workflow/status/actions/deploy-pages/test.yml?label=Tests&logo=github)](https://github.com/actions/deploy-pages/actions/workflows/test.yml) ![Coverage](./coverage_badge.svg) [![Distributables](https://img.shields.io/github/actions/workflow/status/actions/deploy-pages/check-dist.yml?label=Distributables&logo=github)](https://github.com/actions/deploy-pages/actions/workflows/check-dist.yml) [![CodeQL](https://img.shields.io/github/actions/workflow/status/actions/deploy-pages/codeql-analysis.yml?label=CodeQL&logo=github)](https://github.com/actions/deploy-pages/actions/workflows/codeql-analysis.yml)

This action is used to deploy [Actions artifacts][artifacts] to [GitHub Pages](https://pages.github.com/).

## Usage

See [action.yml](action.yml) for the various `inputs` this action supports (or [below](#inputs-📥)).

For examples that make use of this action, check out our [starter-workflows][starter-workflows] in a variety of frameworks.

This action deploys a Pages site previously uploaded as an artifact (e.g. using [`actions/upload-pages-artifact`][upload-pages-artifact]).

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
        uses: actions/deploy-pages@v4 # or specific "vX.X.X" version tag for this action
```

### Inputs 📥

| Input | Required? | Default | Description |
| ----- | --------- | ------- | ----------- |
| `token` | `true` | `${{ github.token }}` | The GitHub token used to create an authenticated client - Provided for you by default! |
| `timeout` | `false` | `"600000"` | Time in milliseconds after which to timeout and cancel the deployment (default: 10 minutes) |
| `error_count` | `false` | `"10"` | Maximum number of status report errors before cancelling a deployment (default: 10) |
| `reporting_interval` | `false` | `"5000"` | Time in milliseconds between two deployment status reports (default: 5 seconds) |
| `artifact_name` | `false` | `"github-pages"` | The name of the artifact to deploy |
| `preview` | `false` | `"false"` | Is this attempting to deploy a pull request as a GitHub Pages preview site? (NOTE: This feature is only in alpha currently and is not available to the public!) |

### Outputs 📤

| Output | Description |
| ------ | ----------- |
| `page_url` | The URL of the deployed Pages site |

### Environment Variables 🌎

| Variable | Description |
| -------- | ----------- |
| `GITHUB_PAGES` | This environment variable is created and set to the string value `"true"` so that framework build tools may choose to differentiate their output based on the intended target hosting platform. |

## Security Considerations

There are a few important considerations to be aware of:

1. The artifact being deployed must have been uploaded in a previous step, either in the same job or a separate job that doesn't execute until the upload is complete. See [`actions/upload-pages-artifact`][upload-pages-artifact] for more information about the format of the artifact we expect.

2. The job that executes the deployment must at minimum have the following permissions:
   - `pages: write`
   - `id-token: write`

3. The deployment should target the `github-pages` environment (you may use a different environment name if needed, but this is not recommended.)

4. If your Pages site is using a source branch, the deployment must originate from this source branch unless [your environment is protected][environment-protection] in which case the environment protection rules take precedence over the source branch rule

5. If your Pages site is using GitHub Actions as the source, while not required we highly recommend you also [protect your environment][environment-protection] (we will configure it by default for you).

## Compatibility

This action is primarily designed for use with GitHub.com's Actions workflows and Pages deployments. However, certain releases should also be compatible with GitHub Enterprise Server (GHES) `3.7` and above.

| Release | GHES Compatibility |
|:---|:---|
| [`v4`](https://github.com/actions/deploy-pages/releases/tag/v4) | :warning: Incompatible at this time |
| [`v3`](https://github.com/actions/deploy-pages/releases/tag/v3) | `>= 3.9` |
| `v3.x.x` | `>= 3.9` |
| [`v2`](https://github.com/actions/deploy-pages/releases/tag/v2) | `>= 3.9` |
| `v2.x.x` | `>= 3.9` |
| [`v1`](https://github.com/actions/deploy-pages/releases/tag/v1) | `>= 3.7` |
| [`v1.2.8`](https://github.com/actions/deploy-pages/releases/tag/v1.2.8) | `>= 3.7` |
| [`v1.2.7`](https://github.com/actions/deploy-pages/releases/tag/v1.2.7) | :warning: `>= 3.9` [Incompatible with prior versions!](https://github.com/actions/deploy-pages/issues/137) |
| [`v1.2.6`](https://github.com/actions/deploy-pages/releases/tag/v1.2.6) | `>= 3.7` |
| `v1.x.x` | `>= 3.7` |

## Release Instructions

In order to release a new version of this Action:

1. Locate the semantic version of the [upcoming release][release-list] (a draft is maintained by the [`draft-release` workflow][draft-release]).

2. Publish the draft release from the `main` branch with semantic version as the tag name, _with_ the checkbox to publish to the GitHub Marketplace checked. :ballot_box_with_check:

3. After publishing the release, the [`release` workflow][release] will automatically run to create/update the corresponding major version tag such as `v1`.

   ⚠️ Environment approval is required. Check the [Release workflow run list][release-workflow-runs].

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

<!-- references -->
[starter-workflows]: https://github.com/actions/starter-workflows/tree/main/pages
[upload-pages-artifact]: https://github.com/actions/upload-pages-artifact
[artifacts]: https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
[environment-protection]: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#environment-protection-rules
[release-list]: https://github.com/actions/deploy-pages/releases
[draft-release]: .github/workflows/draft-release.yml
[release]: .github/workflows/release.yml
[release-workflow-runs]: https://github.com/actions/deploy-pages/actions/workflows/release.yml
