import { formatINR } from "@/lib/format";

type LastDealData = {
  contact: string;
  deal: { amount: number } | null;
};

type TopBrandData = {
  brand: { name: string; total_amount: number } | null;
};

type AllDealsData = {
  deals: Array<{ contact_name: string | null; amount: number }>;
};

export function formatQueryResponse(
  type: "last_deal" | "top_brand" | "all_deals",
  data: LastDealData | TopBrandData | AllDealsData
): string {
  if (type === "last_deal") {
    const payload = data as LastDealData;
    if (!payload.deal) {
      return `No previous deals found for ${payload.contact}.`;
    }
    return `Last deal with ${payload.contact} was ${formatINR(payload.deal.amount)} 💰`;
  }

  if (type === "top_brand") {
    const payload = data as TopBrandData;
    if (!payload.brand) {
      return "No deals yet to calculate top brand.";
    }
    return `Your highest paying brand is ${payload.brand.name} (${formatINR(
      payload.brand.total_amount
    )} total)`;
  }

  const payload = data as AllDealsData;
  if (!payload.deals.length) {
    return "You have 0 deals.";
  }

  const lines = payload.deals
    .slice(0, 3)
    .map((deal) => `- ${deal.contact_name ?? "Unknown"}: ${formatINR(deal.amount)}`);

  return `You have ${payload.deals.length} deals:\n${lines.join("\n")}`;
}
