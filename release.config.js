module.exports = {
    branches: ['main'],  // or 'master'
    plugins: [
      '@semantic-release/commit-analyzer',  // Analyzes commits
      '@semantic-release/release-notes-generator',  // Generates release notes
      '@semantic-release/github',  // Creates GitHub releases
      [
        '@semantic-release/changelog',
        {
          changelogFile: 'CHANGELOG.md',
        },
      ],
      [
        '@semantic-release/git',
        {
          assets: ['CHANGELOG.md', 'package.json'],
          message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
        },
      ],
    ],
};