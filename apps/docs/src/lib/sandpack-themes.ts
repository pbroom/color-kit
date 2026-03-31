import type { SandpackTheme } from '@codesandbox/sandpack-react';
import { sandpackDark } from '@codesandbox/sandpack-themes';

type GitHubSandpackPalette = {
  colors: Partial<SandpackTheme['colors']>;
  syntax: Partial<SandpackTheme['syntax']>;
};

const githubSandpackFont = {
  ...sandpackDark.font,
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
  size: '13px',
  lineHeight: '20px',
} satisfies SandpackTheme['font'];

function createGitHubSandpackTheme(
  palette: GitHubSandpackPalette,
): SandpackTheme {
  return {
    ...sandpackDark,
    colors: {
      ...sandpackDark.colors,
      ...palette.colors,
    },
    syntax: {
      ...sandpackDark.syntax,
      ...palette.syntax,
    },
    font: githubSandpackFont,
  };
}

export const githubDarkSandpackTheme = createGitHubSandpackTheme({
  colors: {
    surface1: '#0D1117',
    surface2: '#161B22',
    surface3: '#30363D',
    clickable: '#8B949E',
    base: '#C9D1D9',
    disabled: '#6E7681',
    hover: '#E6EDF3',
    accent: '#6CB6FF',
    error: '#FF7B72',
    errorSurface: '#490202',
  },
  syntax: {
    plain: '#C9D1D9',
    comment: '#8B949E',
    keyword: '#FF7B72',
    definition: '#DCBDFB',
    punctuation: '#C9D1D9',
    property: '#6CB6FF',
    tag: '#8DDB8C',
    static: '#FFA657',
    string: '#96D0FF',
  },
});

export const githubDimmedSandpackTheme = createGitHubSandpackTheme({
  colors: {
    surface1: '#22272E',
    surface2: '#2D333B',
    surface3: '#444C56',
    clickable: '#768390',
    base: '#E6EDF3',
    disabled: '#636E7B',
    hover: '#F0F6FC',
    accent: '#79C0FF',
    error: '#FF7B72',
    errorSurface: '#5D0F12',
  },
  syntax: {
    plain: '#E6EDF3',
    comment: '#768390',
    keyword: '#FF7B72',
    definition: '#D2A8FF',
    punctuation: '#E6EDF3',
    property: '#79C0FF',
    tag: '#8DDB8C',
    static: '#FFA657',
    string: '#A5D6FF',
  },
});

// Mirrors VS Code's built-in Default Dark Modern theme within Sandpack's theme model.
export const vscodeModernDarkSandpackTheme = createGitHubSandpackTheme({
  ...sandpackDark,
  colors: {
    ...sandpackDark.colors,
    surface1: '#1F1F1F',
    surface2: '#2B2B2B',
    surface3: '#313131',
    clickable: '#9D9D9D',
    base: '#CCCCCC',
    disabled: '#6E7681',
    hover: '#FFFFFF',
    accent: '#0078D4',
    error: '#F85149',
    errorSurface: '#381010',
  },
  syntax: {
    ...sandpackDark.syntax,
    plain: '#CCCCCC',
    comment: '#6A9955',
    keyword: '#569CD6',
    tag: '#569CD6',
    punctuation: '#D4D4D4',
    definition: '#DCDCAA',
    property: '#9CDCFE',
    static: '#4FC1FF',
    string: '#CE9178',
  },
});
