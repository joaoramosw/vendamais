import { getRankingGeral } from "@/actions/ranking-actions";
import { RankingClient } from "./ranking-client";

export default async function RankingPage() {
  const ranking = await getRankingGeral();

  return <RankingClient initialRanking={ranking} />;
}
