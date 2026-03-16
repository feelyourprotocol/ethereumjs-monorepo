import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'EIP-8141 Frame Transaction',
  description:
    'Reference implementation docs for EIP-8141 — implementation journal, design decisions, and spec feedback from the EthereumJS team',
  outDir: '../eip-8141-docs-dist',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Spec Overview', link: '/spec-overview/' },
      { text: 'Implementation', link: '/implementation-journal/' },
      { text: 'Spec Feedback', link: '/spec-feedback/' },
      {
        text: 'Links',
        items: [
          {
            text: 'EIP-8141 (snapshot used)',
            link: 'https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md',
          },
          {
            text: 'EIP-8141 (latest)',
            link: 'https://eips.ethereum.org/EIPS/eip-8141',
          },
          {
            text: 'EthereumJS Monorepo',
            link: 'https://github.com/ethereumjs/ethereumjs-monorepo',
          },
          {
            text: 'Feel Your Protocol',
            link: 'https://feelyourprotocol.org',
          },
          {
            text: 'Magicians Discussion',
            link: 'https://ethereum-magicians.org/t/frame-transaction/27617',
          },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [{ text: 'About This Project', link: '/' }],
      },
      {
        text: 'Spec Overview',
        items: [
          { text: 'Introduction', link: '/spec-overview/' },
          { text: 'Spec Chronology', link: '/spec-overview/chronology' },
          {
            text: 'Transaction Structure',
            link: '/spec-overview/transaction-structure',
          },
          { text: 'Frame Modes', link: '/spec-overview/frame-modes' },
          { text: 'New Opcodes', link: '/spec-overview/opcodes' },
          {
            text: 'Execution Behavior',
            link: '/spec-overview/execution-behavior',
          },
          { text: 'Gas Accounting', link: '/spec-overview/gas-accounting' },
          { text: 'Default Code (EOA)', link: '/spec-overview/default-code' },
        ],
      },
      {
        text: 'Implementation Journal',
        items: [
          { text: 'Overview', link: '/implementation-journal/' },
          {
            text: 'Getting Started',
            link: '/implementation-journal/getting-started',
          },
          {
            text: 'Transaction Parsing',
            link: '/implementation-journal/transaction-parsing',
          },
          {
            text: 'EVM Integration',
            link: '/implementation-journal/evm-integration',
          },
        ],
      },
      {
        text: 'Design Decisions',
        items: [
          { text: 'Overview', link: '/design-decisions/' },
          {
            text: 'Architecture Choices',
            link: '/design-decisions/architecture',
          },
          { text: 'Trade-offs', link: '/design-decisions/trade-offs' },
        ],
      },
      {
        text: 'Spec Feedback',
        items: [
          { text: 'Overview', link: '/spec-feedback/' },
          {
            text: 'Clarity & Completeness',
            link: '/spec-feedback/clarity-and-completeness',
          },
          {
            text: 'Protocol Alignment',
            link: '/spec-feedback/protocol-alignment',
          },
          {
            text: 'Strategic Fit',
            link: '/spec-feedback/strategic-fit',
          },
        ],
      },
    ],
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/ethereumjs/ethereumjs-monorepo',
      },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message:
        'A <a href="https://feelyourprotocol.org">Feel Your Protocol</a> project — EIP-8141 reference implementation by the EthereumJS team.',
    },
    editLink: {
      pattern: 'https://github.com/ethereumjs/ethereumjs-monorepo/edit/main/eip-8141-docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
