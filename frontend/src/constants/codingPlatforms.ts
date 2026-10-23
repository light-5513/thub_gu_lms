import { SiLeetcode, SiCodechef, SiCodeforces, SiHackerrank, SiHackerearth, SiGeeksforgeeks, SiGithub } from "react-icons/si";
import type React from "react";

export const PLATFORM_META: Record<string, { label: string; icon?: React.ElementType }> = {
  github: { label: "GitHub", icon: SiGithub },
  leetcode: { label: "LeetCode", icon: SiLeetcode },
  codechef: { label: "CodeChef", icon: SiCodechef },
  codeforces: { label: "Codeforces", icon: SiCodeforces },
  atcoder: { label: "AtCoder" },
  hackerrank: { label: "HackerRank", icon: SiHackerrank },
  hackerearth: { label: "HackerEarth", icon: SiHackerearth },
  geeksforgeeks: { label: "GeeksForGeeks", icon: SiGeeksforgeeks },
};
