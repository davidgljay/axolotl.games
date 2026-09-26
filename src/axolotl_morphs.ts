export interface Morph {
  id: string;
  name: string;
  body: string;
  belly: string;
  shade: string;
  outline: string;
  fin: string;
  gill: string;
  gillTip: string;
  blush: string;
  eye: string;
  spots: string;
}

export const MORPHS: Morph[] = [
  {
    id: "pink",
    name: "Pink",
    body: "#ffb8c8",
    belly: "#ffe0e8",
    shade: "#f08aa6",
    outline: "#a8465f",
    fin: "rgba(255,210,222,0.9)",
    gill: "#ff6f98",
    gillTip: "#ffa8c0",
    blush: "#ff7fa0",
    eye: "#2a1620",
    spots: "#f59ab2",
  },
  {
    id: "wild",
    name: "Wild",
    body: "#9aa05e",
    belly: "#d2d29a",
    shade: "#747a42",
    outline: "#3f4222",
    fin: "rgba(184,186,122,0.9)",
    gill: "#8a5a80",
    gillTip: "#b886aa",
    blush: "#e0907e",
    eye: "#1a1a10",
    spots: "#5f6434",
  },
  {
    id: "gold",
    name: "Golden",
    body: "#ffd66b",
    belly: "#fff0b8",
    shade: "#f0b440",
    outline: "#b07818",
    fin: "rgba(255,228,150,0.9)",
    gill: "#ff9a6b",
    gillTip: "#ffc4a0",
    blush: "#ff9a7a",
    eye: "#5a2a2a",
    spots: "#f2c050",
  },
  {
    id: "midnight",
    name: "Midnight",
    body: "#565c7c",
    belly: "#7c83a2",
    shade: "#3b3f5a",
    outline: "#1b1d2c",
    fin: "rgba(112,118,152,0.9)",
    gill: "#7a68b0",
    gillTip: "#a898e0",
    blush: "#c07ab8",
    eye: "#0b0b12",
    spots: "#40445f",
  },
];
