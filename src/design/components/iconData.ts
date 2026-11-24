/**
 * Vuesax linear icons, ported from `Icon.figcraft` (the same kit the design
 * system names in DESIGN.md). Generated from SVG exports; do not hand-edit the
 * path data.
 *
 * Each icon keeps the kit's 32-unit canvas and 1.5 stroke, so one `size` gives
 * the whole app one icon weight. The paths are drawn with `stroke`, never fill,
 * except where the kit itself fills a shape.
 */
export interface IconPath {
  /** SVG path data. */
  d: string;
  /** The kit's offset for this sub-path, in canvas units. */
  translate: readonly [number, number] | null;
  strokeWidth: number;
  filled?: boolean;
}

export const iconData = {
  add: {
    viewBox: '0 0 24 24',
    paths: [
      { d: 'M0 0L12 0', translate: [6, 12], strokeWidth: 1.5 },
      { d: 'M0 12L0 0', translate: [12, 6], strokeWidth: 1.5 },
    ],
  },
  addCircle: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M10 20C15.5 20 20 15.5 20 10C20 4.5 15.5 0 10 0C4.5 0 0 4.5 0 10C0 15.5 4.5 20 10 20Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0 0L8 0', translate: [12, 16], strokeWidth: 1.5 },
      { d: 'M0 8L0 0', translate: [16, 12], strokeWidth: 1.5 },
    ],
  },
  arrowDown: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M20 10C20 15.523 15.523 20 10 20C4.477 20 0 15.523 0 10C0 4.477 4.477 0 10 0C15.523 0 20 4.477 20 10Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0 0L0 6', translate: [16, 12.5], strokeWidth: 1.5 },
      { d: 'M0 0L3 3L6 0', translate: [13, 16.5], strokeWidth: 1.5 },
    ],
  },
  arrowLeft: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M20 10C20 15.523 15.523 20 10 20C4.477 20 0 15.523 0 10C0 4.477 4.477 0 10 0C15.523 0 20 4.477 20 10Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M6 0L0 0', translate: [13.5, 16], strokeWidth: 1.5 },
      { d: 'M3 0L0 3L3 6', translate: [12.5, 13], strokeWidth: 1.5 },
    ],
  },
  arrowRight: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M20 10C20 15.523 15.523 20 10 20C4.477 20 0 15.523 0 10C0 4.477 4.477 0 10 0C15.523 0 20 4.477 20 10Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0 0L6 0', translate: [12.5, 16], strokeWidth: 1.5 },
      { d: 'M0 6L3 3L0 0', translate: [16.5, 13], strokeWidth: 1.5 },
    ],
  },
  arrowUp: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M20 10C20 15.523 15.523 20 10 20C4.477 20 0 15.523 0 10C0 4.477 4.477 0 10 0C15.523 0 20 4.477 20 10Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0 6L0 0', translate: [16, 13.5], strokeWidth: 1.5 },
      { d: 'M0 3L3 0L6 3', translate: [13, 12.5], strokeWidth: 1.5 },
    ],
  },
  bell: {
    viewBox: '0 0 28.042 32.119',
    paths: [
      { d: 'M8.046 0C4.736 0 2.046 2.69 2.046 6L2.046 8.89C2.046 9.5 1.786 10.43 1.476 10.95L0.326 12.86C-0.384 14.04 0.106 15.35 1.406 15.79C5.716 17.23 10.366 17.23 14.676 15.79C15.886 15.39 16.416 13.96 15.756 12.86L14.606 10.95C14.306 10.43 14.046 9.5 14.046 8.89L14.046 6C14.046 2.7 11.346 0 8.046 0Z', translate: [6, 6.97], strokeWidth: 1.5 },
      { d: 'M3.7 1.26C3.39 1.17 3.07 1.1 2.74 1.06C1.78 0.94 0.86 1.01 0 1.26C0.29 0.52 1.01 0 1.85 0C2.69 0 3.41 0.52 3.7 1.26Z', translate: [12.196, 6], strokeWidth: 1.5 },
      { d: 'M6 0C6 1.65 4.65 3 3 3C2.18 3 1.42 2.66 0.88 2.12C0.34 1.58 0 0.82 0 0', translate: [11.046, 23.119], strokeWidth: 1.5 },
    ],
  },
  box: {
    viewBox: '0 0 29.78 32',
    paths: [
      { d: 'M15.56 16.67L17.78 15.56L17.78 12.78M11.11 7.78L8.89 8.89L11.11 7.78ZM8.89 8.89L6.67 7.78L8.89 8.89ZM8.89 8.89L8.89 11.67L8.89 8.89ZM17.78 4.44L15.56 5.55L17.78 4.44ZM17.78 4.44L15.56 3.33L17.78 4.44ZM17.78 4.44L17.78 7.22L17.78 4.44ZM11.11 1.11L8.89 0L6.67 1.11L11.11 1.11ZM0 4.44L2.22 3.33L0 4.44ZM0 4.44L2.22 5.55L0 4.44ZM0 4.44L0 7.22L0 4.44ZM8.89 20L6.67 18.89L8.89 20ZM8.89 20L11.11 18.89L8.89 20ZM8.89 20L8.89 17.22L8.89 20ZM2.22 16.67L0 15.56L0 12.78L2.22 16.67Z', translate: [6, 6], strokeWidth: 1.5 },
    ],
  },
  calendar: {
    viewBox: '0 0 30 32',
    paths: [
      { d: 'M0 0L0 3', translate: [11, 6], strokeWidth: 1.5 },
      { d: 'M0 0L0 3', translate: [19, 6], strokeWidth: 1.5 },
      { d: 'M0 0L17 0', translate: [6.5, 13.09], strokeWidth: 1.5 },
      { d: 'M18 5L18 13.5C18 16.5 16.5 18.5 13 18.5L5 18.5C1.5 18.5 0 16.5 0 13.5L0 5C0 2 1.5 0 5 0L13 0C16.5 0 18 2 18 5Z', translate: [6, 7.5], strokeWidth: 1.5 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [18.2, 17.2], strokeWidth: 2 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [18.2, 20.2], strokeWidth: 2 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [14.501, 17.2], strokeWidth: 2 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [14.501, 20.2], strokeWidth: 2 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [10.8, 17.2], strokeWidth: 2 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [10.8, 20.2], strokeWidth: 2 },
    ],
  },
  cart: {
    viewBox: '0 0 31.548 32',
    paths: [
      { d: 'M0 0L1.74 0C2.82 0 3.67 0.93 3.58 2L2.75 11.96C2.61 13.59 3.9 14.99 5.54 14.99L16.19 14.99C17.63 14.99 18.89 13.81 19 12.38L19.54 4.88C19.66 3.22 18.4 1.87 16.73 1.87L3.82 1.87', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M2.5 1.25C2.5 1.94 1.94 2.5 1.25 2.5C0.56 2.5 0 1.94 0 1.25C0 0.56 0.56 0 1.25 0C1.94 0 2.5 0.56 2.5 1.25Z', translate: [19, 23.5], strokeWidth: 1.5 },
      { d: 'M2.5 1.25C2.5 1.94 1.94 2.5 1.25 2.5C0.56 2.5 0 1.94 0 1.25C0 0.56 0.56 0 1.25 0C1.94 0 2.5 0.56 2.5 1.25Z', translate: [11, 23.5], strokeWidth: 1.5 },
      { d: 'M0 0L12 0', translate: [13, 12], strokeWidth: 1.5 },
    ],
  },
  chart: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M7 20L13 20C18 20 20 18 20 13L20 7C20 2 18 0 13 0L7 0C2 0 0 2 0 7L0 13C0 18 2 20 7 20Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M2 13C3.1 13 4 12.1 4 11L4 2C4 0.9 3.1 0 2 0C0.9 0 0 0.9 0 2L0 11C0 12.1 0.89 13 2 13Z', translate: [17.5, 9.5], strokeWidth: 1.5 },
      { d: 'M2 7.5C3.1 7.5 4 6.6 4 5.5L4 2C4 0.9 3.1 0 2 0C0.9 0 0 0.9 0 2L0 5.5C0 6.6 0.89 7.5 2 7.5Z', translate: [10.5, 15], strokeWidth: 1.5 },
    ],
  },
  clock: {
    viewBox: '0 0 25 32',
    paths: [
      { d: 'M0 0L0 2.79L1.4 4.19', translate: [12.5, 13.66], strokeWidth: 1.5 },
      { d: 'M0 6.5C0 2.91 2.91 0 6.5 0C10.09 0 13 2.91 13 6.5C13 8.58 12.02 10.44 10.5 11.63L10.49 11.63C9.39 12.49 8.01 13 6.5 13C5.01 13 3.64 12.5 2.54 11.65L2.53 11.65C0.99 10.46 0 8.6 0 6.5Z', translate: [6, 9.5], strokeWidth: 1.5 },
      { d: 'M0 0.02L0.01 0.02C1.11 0.87 2.48 1.37 3.97 1.37C5.48 1.37 6.86 0.86 7.96 0L7.97 0L7.46 2.47C6.97 4.37 5.87 4.87 4.52 4.87L3.43 4.87C2.08 4.87 0.97 4.37 0.49 2.46L0 0.02Z', translate: [8.53, 21.13], strokeWidth: 1.5 },
      { d: 'M0 4.85L0.01 4.85C1.11 4 2.48 3.5 3.97 3.5C5.48 3.5 6.86 4.01 7.96 4.87L7.97 4.87L7.46 2.4C6.97 0.5 5.87 0 4.52 0L3.43 0C2.08 0 0.97 0.5 0.49 2.41L0 4.85Z', translate: [8.53, 6], strokeWidth: 1.5 },
    ],
  },
  close: {
    viewBox: '0 0 30.971 30.97',
    paths: [
      { d: 'M0 0L19.798 0', translate: null, strokeWidth: 1.5 },
      { d: 'M0 19.798L0 0', translate: null, strokeWidth: 1.5 },
    ],
  },
  download: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M0 0L0 6L2 4', translate: [13, 15], strokeWidth: 1.5 },
      { d: 'M2 2L0 0', translate: [11, 19], strokeWidth: 1.5 },
      { d: 'M20 8L20 13C20 18 18 20 13 20L7 20C2 20 0 18 0 13L0 7C0 2 2 0 7 0L12 0', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M8 8L4 8C1 8 0 7 0 4L0 0L8 8Z', translate: [18, 6], strokeWidth: 1.5 },
    ],
  },
  edit: {
    viewBox: '0 0 32.251 32.251',
    paths: [
      { d: 'M9 0L7 0C2 0 0 2 0 7L0 13C0 18 2 20 7 20L13 20C18 20 20 18 20 13L20 11', translate: [6, 6.251], strokeWidth: 1.5 },
      { d: 'M8.991 1.271L1.111 9.151C0.811 9.451 0.511 10.041 0.451 10.471L0.021 13.481C-0.139 14.571 0.631 15.331 1.721 15.181L4.731 14.751C5.151 14.691 5.741 14.391 6.051 14.091L13.931 6.211C15.291 4.851 15.931 3.271 13.931 1.271C11.931 -0.729 10.351 -0.089 8.991 1.271Z', translate: [11.049, 6], strokeWidth: 1.5 },
      { d: 'M0 0C0.67 2.39 2.54 4.26 4.94 4.94', translate: [18.91, 8.401], strokeWidth: 1.5 },
    ],
  },
  exportIcon: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M0 8.2L8.2 0', translate: [17, 6.8], strokeWidth: 1.5 },
      { d: 'M4.8 4.8L4.8 0L0 0', translate: [21.2, 6], strokeWidth: 1.5 },
      { d: 'M9 0L7 0C2 0 0 2 0 7L0 13C0 18 2 20 7 20L13 20C18 20 20 18 20 13L20 11', translate: [6, 6], strokeWidth: 1.5 },
    ],
  },
  filter: {
    viewBox: '0 0 29.2 31.797',
    paths: [
      { d: 'M2 0L15.2 0C16.3 0 17.2 0.9 17.2 2L17.2 4.2C17.2 5 16.7 6 16.2 6.5L11.9 10.3C11.3 10.8 10.9 11.8 10.9 12.6L10.9 16.9C10.9 17.5 10.5 18.3 10 18.6L8.6 19.5C7.3 20.3 5.5 19.4 5.5 17.8L5.5 12.5C5.5 11.8 5.1 10.9 4.7 10.4L0.9 6.4C0.4 5.9 0 5 0 4.4L0 2.1C0 0.9 0.9 0 2 0Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M4.93 0L0 7.9', translate: [8.6, 6], strokeWidth: 1.5 },
    ],
  },
  folder: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M20 9L20 15C20 19 19 20 15 20L5 20C1 20 0 19 0 15L0 5C0 1 1 0 5 0L6.5 0C8 0 8.33 0.44 8.9 1.2L10.4 3.2C10.78 3.7 11 4 12 4L15 4C19 4 20 5 20 9Z', translate: [6, 6], strokeWidth: 1.5 },
    ],
  },
  importIcon: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M8.2 0L0 8.2', translate: [17.8, 6], strokeWidth: 1.5 },
      { d: 'M0 0L0 4.83L4.83 4.83', translate: [17, 10.17], strokeWidth: 1.5 },
      { d: 'M9 0L7 0C2 0 0 2 0 7L0 13C0 18 2 20 7 20L13 20C18 20 20 18 20 13L20 11', translate: [6, 6], strokeWidth: 1.5 },
    ],
  },
  minus: {
    viewBox: '0 0 24 24',
    paths: [
      { d: 'M0 0L12 0', translate: [6, 12], strokeWidth: 1.5 },
    ],
  },
  money: {
    viewBox: '0 0 32 29',
    paths: [
      { d: 'M15 17L5 17C2 17 0 15.5 0 12L0 5C0 1.5 2 0 5 0L15 0C18 0 20 1.5 20 5L20 12C20 15.5 18 17 15 17Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M6 3C6 4.657 4.657 6 3 6C1.343 6 0 4.657 0 3C0 1.343 1.343 0 3 0C4.657 0 6 1.343 6 3Z', translate: [13, 11.5], strokeWidth: 1.5 },
      { d: 'M0 0L0 5', translate: [9.5, 12], strokeWidth: 1.5 },
      { d: 'M0 0L0 5', translate: [22.5, 12], strokeWidth: 1.5 },
    ],
  },
  moreSquare: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M7 20L13 20C18 20 20 18 20 13L20 7C20 2 18 0 13 0L7 0C2 0 0 2 0 7L0 13C0 18 2 20 7 20Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [19.502, 15.5], strokeWidth: 2 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [15.501, 15.5], strokeWidth: 2 },
      { d: 'M0.495 0.5L0.503 0.5', translate: [11.5, 15.5], strokeWidth: 2 },
    ],
  },
  people: {
    viewBox: '0 0 31.965 32.002',
    paths: [
      { d: 'M2.67 5.16C2.61 5.15 2.54 5.15 2.48 5.16C1.1 5.11 0 3.98 0 2.58C0 1.15 1.15 0 2.58 0C4.01 0 5.16 1.16 5.16 2.58C5.15 3.98 4.05 5.11 2.67 5.16Z', translate: [19.327, 6], strokeWidth: 1.5 },
      { d: 'M0.03 4.94C1.4 5.17 2.91 4.93 3.97 4.22C5.38 3.28 5.38 1.74 3.97 0.8C2.9 0.09 1.37 -0.15 0 0.09', translate: [20.937, 13.5], strokeWidth: 1.5 },
      { d: 'M2.49 5.16C2.55 5.15 2.62 5.15 2.68 5.16C4.06 5.11 5.16 3.98 5.16 2.58C5.16 1.15 4.01 0 2.58 0C1.15 0 0 1.16 0 2.58C0.01 3.98 1.11 5.11 2.49 5.16Z', translate: [7.477, 6], strokeWidth: 1.5 },
      { d: 'M4.997 4.94C3.627 5.17 2.117 4.93 1.058 4.22C-0.352 3.28 -0.352 1.74 1.058 0.8C2.128 0.09 3.657 -0.15 5.027 0.09', translate: [6, 13.5], strokeWidth: 1.5 },
      { d: 'M2.67 5.16C2.61 5.15 2.54 5.15 2.48 5.16C1.1 5.11 0 3.98 0 2.58C0 1.15 1.15 0 2.58 0C4.01 0 5.16 1.16 5.16 2.58C5.15 3.98 4.05 5.12 2.67 5.16Z', translate: [13.327, 13.47], strokeWidth: 1.5 },
      { d: 'M1.058 0.795C-0.352 1.735 -0.352 3.275 1.058 4.215C2.658 5.285 5.277 5.285 6.877 4.215C8.287 3.275 8.287 1.735 6.877 0.795C5.287 -0.265 2.658 -0.265 1.058 0.795Z', translate: [12.03, 20.984], strokeWidth: 1.5 },
    ],
  },
  receipt: {
    viewBox: '0 0 32 32.583',
    paths: [
      { d: 'M6 4L6 6.42C6 8 5 9 3.42 9L0 9L0 2.01C0 0.9 0.91 0 2.02 0C3.11 0.01 4.11 0.45 4.83 1.17C5.55 1.9 6 2.9 6 4Z', translate: [20, 6], strokeWidth: 1.5 },
      { d: 'M0 5L0 19C0 19.83 0.94 20.3 1.6 19.8L3.31 18.52C3.71 18.22 4.27 18.26 4.63 18.62L6.29 20.29C6.68 20.68 7.32 20.68 7.71 20.29L9.39 18.61C9.74 18.26 10.3 18.22 10.69 18.52L12.4 19.8C13.06 20.29 14 19.82 14 19L14 2C14 0.9 14.9 0 16 0L5 0L4 0C1 0 0 1.79 0 4L0 5Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0 0L3 0', translate: [13, 17.01], strokeWidth: 1.5 },
      { d: 'M0 0L3 0', translate: [13, 13.01], strokeWidth: 1.5 },
      { d: 'M0 0L0.009 0', translate: [9.996, 17], strokeWidth: 2 },
      { d: 'M0 0L0.009 0', translate: [9.996, 13], strokeWidth: 2 },
    ],
  },
  refresh: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M12.55 19.67C16.84 18.54 20 14.64 20 10C20 4.48 15.56 0 10 0C3.33 0 0 5.56 0 5.56M0 5.56L0 1M0 5.56L2.01 5.56L4.44 5.56', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0 0C0 5.52 4.48 10 10 10', translate: [6, 16], strokeWidth: 1.5 },
    ],
  },
  search: {
    viewBox: '0 0 31.997 32.003',
    paths: [
      { d: 'M18 9C18 13.971 13.971 18 9 18C4.029 18 0 13.971 0 9C0 4.029 4.029 0 9 0C13.971 0 18 4.029 18 9Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0.1 1.97C0.63 3.57 1.84 3.73 2.77 2.33C3.62 1.05 3.06 0 1.52 0C0.38 -0.01 -0.26 0.88 0.1 1.97Z', translate: [22.83, 22.72], strokeWidth: 1.5 },
    ],
  },
  share: {
    viewBox: '0 0 31.9 31.721',
    paths: [
      { d: 'M0 0C2 1.39 3.38 3.6 3.66 6.15', translate: [20.91, 10.03], strokeWidth: 1.5 },
      { d: 'M0 6.15C0.26 3.61 1.62 1.4 3.6 0', translate: [7.44, 10.08], strokeWidth: 1.5 },
      { d: 'M0 0C1.16 0.59 2.48 0.92 3.87 0.92C5.21 0.92 6.47 0.62 7.6 0.07', translate: [12.14, 24.801], strokeWidth: 1.5 },
      { d: 'M5.56 2.78C5.56 4.315 4.315 5.56 2.78 5.56C1.245 5.56 0 4.315 0 2.78C0 1.245 1.245 0 2.78 0C4.315 0 5.56 1.245 5.56 2.78Z', translate: [13.23, 6], strokeWidth: 1.5 },
      { d: 'M5.56 2.78C5.56 4.315 4.315 5.56 2.78 5.56C1.245 5.56 0 4.315 0 2.78C0 1.245 1.245 0 2.78 0C4.315 0 5.56 1.245 5.56 2.78Z', translate: [6, 18.221], strokeWidth: 1.5 },
      { d: 'M5.56 2.78C5.56 4.315 4.315 5.56 2.78 5.56C1.245 5.56 0 4.315 0 2.78C0 1.245 1.245 0 2.78 0C4.315 0 5.56 1.245 5.56 2.78Z', translate: [20.34, 18.221], strokeWidth: 1.5 },
    ],
  },
  tick: {
    viewBox: '0 0 32 32',
    paths: [
      { d: 'M10 20C15.5 20 20 15.5 20 10C20 4.5 15.5 0 10 0C4.5 0 0 4.5 0 10C0 15.5 4.5 20 10 20Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0 2.83L2.83 5.66L8.5 0', translate: [11.75, 13.17], strokeWidth: 1.5 },
    ],
  },
  trash: {
    viewBox: '0 0 30 32',
    paths: [
      { d: 'M18 0.5C14.67 0.17 11.32 0 7.98 0C6 0 4.02 0.1 2.04 0.3L0 0.5', translate: [6, 9.48], strokeWidth: 1.5 },
      { d: 'M0 2.97L0.22 1.66C0.38 0.71 0.5 0 2.19 0L4.81 0C6.5 0 6.63 0.75 6.78 1.67L7 2.97', translate: [11.5, 6], strokeWidth: 1.5 },
      { d: 'M13.7 0L13.05 10.07C12.94 11.64 12.85 12.86 10.06 12.86L3.64 12.86C0.85 12.86 0.76 11.64 0.65 10.07L0 0', translate: [8.15, 13.14], strokeWidth: 1.5 },
      { d: 'M0 0L3.33 0', translate: [13.33, 20.5], strokeWidth: 1.5 },
      { d: 'M0 0L5 0', translate: [12.5, 16.5], strokeWidth: 1.5 },
    ],
  },
  user: {
    viewBox: '0 0 29.18 32',
    paths: [
      { d: 'M10 5C10 7.761 7.761 10 5 10C2.239 10 0 7.761 0 5C0 2.239 2.239 0 5 0C7.761 0 10 2.239 10 5Z', translate: [9.59, 6], strokeWidth: 1.5 },
      { d: 'M17.18 7C17.18 3.13 13.33 0 8.59 0C3.85 0 0 3.13 0 7', translate: [6, 19], strokeWidth: 1.5 },
    ],
  },
  wallet: {
    viewBox: '0 0 32.059 31.954',
    paths: [
      { d: 'M15.54 5.8C15.12 6.21 14.88 6.8 14.94 7.43C15.03 8.51 16.02 9.3 17.1 9.3L19 9.3L19 10.49C19 12.56 17.31 14.25 15.24 14.25L3.76 14.25C1.69 14.25 0 12.56 0 10.49L0 3.76C0 1.69 1.69 0 3.76 0L15.24 0C17.31 0 19 1.69 19 3.76L19 5.2L16.98 5.2C16.42 5.2 15.91 5.42 15.54 5.8Z', translate: [6, 11.704], strokeWidth: 1.5 },
      { d: 'M0 10.364L0 5.794C0 4.604 0.73 3.544 1.84 3.124L9.78 0.124C11.02 -0.346 12.35 0.574 12.35 1.904L12.35 5.704', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M5.129 1.02L5.129 3.08C5.129 3.63 4.689 4.08 4.129 4.1L2.169 4.1C1.089 4.1 0.099 3.31 0.009 2.23C-0.051 1.6 0.189 1.01 0.609 0.6C0.979 0.22 1.489 0 2.049 0L4.129 0C4.689 0.02 5.129 0.47 5.129 1.02Z', translate: [20.93, 16.904], strokeWidth: 1.5 },
      { d: 'M0 0L7 0', translate: [10.5, 15.954], strokeWidth: 1.5 },
    ],
  },
  warning: {
    viewBox: '0 0 30.17 32',
    paths: [
      { d: 'M0 0L0 5.25', translate: [15.09, 11.75], strokeWidth: 1.5 },
      { d: 'M18.17 6.58L18.17 13.42C18.17 14.54 17.57 15.58 16.6 16.15L10.66 19.58C9.69 20.14 8.49 20.14 7.51 19.58L1.57 16.15C0.6 15.59 0 14.55 0 13.42L0 6.58C0 5.46 0.6 4.42 1.57 3.85L7.51 0.42C8.48 -0.14 9.68 -0.14 10.66 0.42L16.6 3.85C17.57 4.42 18.17 5.45 18.17 6.58Z', translate: [6, 6], strokeWidth: 1.5 },
      { d: 'M0 0L0 0.1', translate: [15.09, 20.2], strokeWidth: 2 },
    ],
  },
} as const;

export type IconName = keyof typeof iconData;
