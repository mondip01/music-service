import { cacheService } from "./cacheService";
import { homeRepository } from "../repository/home.repository";
import { hydrateContent } from "./catalogView.service";
import { catalogRepository } from "../repository/catalog.repository";
import { getUserProfile } from "../infra/clients/userService.client";

const HOME_TTL = 180;

async function buildDefaultSections() {
  const [featured, devotion, moments, trending] = await Promise.all([
    catalogRepository.findFeatured(10),
    catalogRepository.findCategories(),
    catalogRepository.findCategories(),
    catalogRepository.findTrending(10),
  ]);

  return [
    {
      key: "todays_divine_picks",
      title: "Today's Divine Picks",
      layout: "GRID_2",
      position: 0,
      enabled: true,
      items: featured.map((row, index) => ({ type: "TRACK" as const, refId: String(row._id), position: index })),
    },
    {
      key: "explore_by_devotion",
      title: "Explore by Devotion",
      layout: "HORIZONTAL",
      position: 1,
      enabled: true,
      items: devotion.filter((row) => row.group === "DEVOTION" || row.group === "GENERAL").slice(0, 12).map((row, index) => ({ type: "CATEGORY" as const, refId: String(row._id), position: index })),
    },
    {
      key: "bhakti_for_every_moment",
      title: "Bhakti for Every Moment",
      layout: "GRID_2_LARGE",
      position: 2,
      enabled: true,
      items: moments.filter((row) => row.group === "MOMENT").slice(0, 8).map((row, index) => ({ type: "CATEGORY" as const, refId: String(row._id), position: index })),
    },
    {
      key: "trending",
      title: "Trending",
      layout: "HORIZONTAL",
      position: 3,
      enabled: true,
      items: trending.map((row, index) => ({ type: "TRACK" as const, refId: String(row._id), position: index })),
    },
  ];
}

async function hydrateSection(section: any) {
  const sortedItems = [...(section.items ?? [])].sort((a, b) => a.position - b.position);
  const hydrated = await Promise.all(sortedItems.map(async (item) => {
    try {
      const content = await hydrateContent(item.type, String(item.refId));
      return {
        type: item.type,
        id: String(item.refId),
        position: item.position,
        name: content.name,
        image: content.image ?? null,
        data: content,
      };
    } catch {
      return null;
    }
  }));

  return {
    key: section.key,
    title: section.title,
    subtitle: section.subtitle ?? null,
    layout: section.layout,
    position: section.position,
    items: hydrated.filter(Boolean),
  };
}

export const homeService = {
  async getHome(userId?: string) {
    const cacheKey = "music:home:sections:v1";
    let sections = await cacheService.get<any[]>(cacheKey);

    if (!sections) {
      const configured = await homeRepository.findAll();
      const defaults = await buildDefaultSections();
      const configuredByKey = new Map(configured.map((section: any) => [section.key, section]));
      const merged = defaults
        .map((fallback: any) => configuredByKey.has(fallback.key) ? configuredByKey.get(fallback.key) : fallback)
        .filter((section: any) => section?.enabled !== false);
      const custom = configured.filter((section: any) => section.enabled !== false && !defaults.some((fallback: any) => fallback.key === section.key));
      const sourceSections = [...merged, ...custom].sort((a: any, b: any) => a.position - b.position);
      sections = [];
      for (const section of sourceSections) sections.push(await hydrateSection(section));
      await cacheService.set(cacheKey, sections, HOME_TTL);
    }

    const profile = userId ? await getUserProfile(userId).catch(() => null) : null;
    return {
      welcomeName: profile?.displayName ?? null,
      sections,
    };
  },

  async getSection(key: string, userId?: string) {
    const home = await this.getHome(userId);
    return home.sections.find((section: any) => section.key === key) ?? {
      key,
      title: key,
      subtitle: null,
      layout: "HORIZONTAL",
      position: 0,
      items: [],
    };
  },

  async invalidate() {
    await cacheService.delByPattern("music:home:*");
  },
};
