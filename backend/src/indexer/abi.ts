export const MINORITY_GAME_ABI = [
  {
    type: "function",
    name: "getGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "startTime", type: "uint256" },
          { name: "totalPool", type: "uint256" },
          { name: "countA", type: "uint256" },
          { name: "countB", type: "uint256" },
          { name: "winningChoice", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "payoutPerPlayer", type: "uint256" },
          { name: "isTie", type: "bool" },
          { name: "question", type: "string" },
          { name: "optionA", type: "string" },
          { name: "optionB", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "resolveGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "GameCreated",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "startTime", type: "uint256", indexed: false },
      { name: "question", type: "string", indexed: false },
      { name: "optionA", type: "string", indexed: false },
      { name: "optionB", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Joined",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "choice", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Resolved",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winningChoice", type: "uint8", indexed: false },
      { name: "isTie", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
