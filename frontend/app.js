const markets = [
  {
    name: "BTC above $85k by month-end",
    volume: "$442k",
    yes: "61¢",
    no: "39¢",
  },
  { name: "SOL ETF approved by June?", volume: "$308k", yes: "34¢", no: "66¢" },
  {
    name: "Fed cuts rates in next meeting",
    volume: "$219k",
    yes: "29¢",
    no: "71¢",
  },
  {
    name: "ETH gas below 8 gwei this week",
    volume: "$182k",
    yes: "48¢",
    no: "52¢",
  },
];

const marketList = document.getElementById("market-list");

for (const market of markets) {
  const card = document.createElement("article");
  card.className = "market-card";
  card.innerHTML = `
    <h4>${market.name}</h4>
    <div class="meta">
      <span>Volume ${market.volume}</span>
      <span>Liquidity: High</span>
    </div>
    <div class="odds">
      <button class="yes">Yes ${market.yes}</button>
      <button class="no">No ${market.no}</button>
    </div>
  `;
  marketList.appendChild(card);
}
