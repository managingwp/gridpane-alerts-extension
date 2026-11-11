import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * One explicit sidebar entry per page. Docusaurus hides orphans; the publish
 * gate (`scripts/check-docs-site.sh`) fails on them, so add the page and its
 * entry in the same commit.
 */
const sidebars: SidebarsConfig = {
  docs: [
    'index',
    {
      type: 'category',
      label: 'Getting started',
      items: ['getting-started/installation', 'getting-started/first-run'],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/sync',
        'guides/search-and-export',
        'guides/webhook',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/features',
        'reference/roadmap',
        'reference/collection-and-storage',
        'reference/limits',
        'reference/privacy',
        'reference/storage-decisions',
      ],
    },
    {
      type: 'category',
      label: 'History',
      items: ['history/google-sheets-destination'],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'contributing/development',
        'contributing/release',
        'contributing/chrome-web-store',
        'contributing/docs-site',
      ],
    },
  ],
};

export default sidebars;
