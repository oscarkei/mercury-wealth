/** Public source facts checked 27 October 2026. Charts are Mercury redraws, not portfolio returns. */
export const homeResearch = [
  {
    id: "ubs",
    publisher: "UBS",
    collection: "WEALTH INTELLIGENCE",
    date: "30 Jun 2026",
    title: "Global Wealth Report 2026",
    headline: "Wealth grew.\nUnevenly.",
    deck: "A stronger year. A different story in every region.",
    metric: "+10.8%",
    metricLabel: "global personal wealth · 2025, USD",
    url: "https://www.ubs.com/global/en/wealthmanagement/insights/global-wealth-report-clients.html",
    dataUrl:
      "https://www.ubs.com/global/en/media/display-page-ndp/en-20260630-gwr-2026.html",
    findings: [
      "Worldwide personal wealth expanded 10.8% in 2025, measured in US dollars.",
      "EMEA led regional growth. A weaker dollar magnified gains outside the US.",
      "The study covers 56 markets, representing more than 92% of global wealth.",
    ],
    chartTitle: "Growth, seen two ways",
    charts: [
      {
        id: "region",
        label: "By region",
        caption: "2025 personal wealth growth · nominal USD %",
        data: [
          { name: "EMEA", value: 17.5 },
          { name: "Global", value: 10.8 },
          { name: "Americas", value: 8.5 },
          { name: "APAC", value: 5.9 },
        ],
      },
      {
        id: "year",
        label: "By year",
        caption: "Global personal wealth growth · nominal USD %",
        data: [
          { name: "2023", value: 4.2 },
          { name: "2024", value: 4.6 },
          { name: "2025", value: 10.8 },
        ],
      },
    ],
    question:
      "How much of a change in family wealth comes from assets, and how much from currency?",
    note: "Aggregate personal wealth, not investment performance. Chart redrawn by Mercury from the UBS release.",
  },
  {
    id: "jb",
    publisher: "Julius Baer",
    collection: "LIFESTYLE & WEALTH",
    date: "7 Jul 2026",
    title: "Global Wealth and Lifestyle Report 2026",
    headline: "The price of\nliving well.",
    deck: "Same lifestyle. Different currency. A new cost.",
    metric: "+10.2%",
    metricLabel: "premium lifestyle costs · 2026, USD",
    url: "https://www.juliusbaer.com/en/spotlight/global-wealth-and-lifestyle-report-2026/",
    dataUrl:
      "https://www.juliusbaer.com/en/media/news-portal/julius-baer-publishes-global-wealth-and-lifestyle-report-2026/",
    findings: [
      "Premium lifestyle costs rose 10.2% on average in US dollar terms.",
      "Currency shifts drove much of the increase; Singapore remained the costliest city.",
      "The index compares 20 goods and services across 25 cities. Collection ended in late February 2026, before the conflict discussed in the report.",
    ],
    chartTitle: "What changed the bill?",
    charts: [
      {
        id: "region",
        label: "By region",
        caption: "2026 lifestyle cost change · USD %",
        data: [
          { name: "Europe", value: 14.1 },
          { name: "Global", value: 10.2 },
          { name: "APAC", value: 7.4 },
        ],
      },
      {
        id: "category",
        label: "Selected goods",
        caption: "2026 price change · USD %",
        data: [
          { name: "Jewellery", value: 16.4 },
          { name: "Watches", value: 15.5 },
          { name: "Luxury goods", value: 12.3 },
        ],
      },
    ],
    question:
      "Do the currencies you hold match the places where your family plans to spend?",
    note: "A premium lifestyle basket, not general inflation or portfolio returns. Mercury redraw using Julius Baer’s published figures.",
  },
] as const;
export type HomeResearch = (typeof homeResearch)[number];
