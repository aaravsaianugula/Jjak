/**
 * The Flower Road (꽃길 · 花の道): fifty real places in Korea and Japan, one per
 * Journey chapter of twelve levels. Chapter i plays in season i % 4 (spring,
 * summer, autumn, winter), so every place sits in the season it is loved for.
 *
 * Names: `ko` is the Hangul name; `ja` is the written form in Chinese
 * characters — Hanja for Korean places (慶州), Kanji for Japanese ones (京都).
 * Seoul has no standard Hanja, so it uses the Japanese katakana name.
 *
 * Postcards stay secular, gentle and factual. No disputed waters or islands.
 */

export type Country = 'KR' | 'JP';
/** 0 spring, 1 summer, 2 autumn, 3 winter */
export type Season = 0 | 1 | 2 | 3;

/** The real calendar's season for each month, January first (northern hemisphere, as Korea and Japan). */
const MONTH_SEASON: readonly Season[] = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3];
/** The season of a date in local time: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter. */
export function calendarSeason(d: Date): Season {
  return MONTH_SEASON[d.getMonth()];
}

/** The idea a chapter features. 'basics' = chapter 1, 'mix' = several at once. */
export type Focus = 'basics' | 'stones' | 'leaves' | 'snow' | 'lucky' | 'knots' | 'wind' | 'gates' | 'fences' | 'torii' | 'streams' | 'mix';

export interface RouteChapter {
  /** stable id (save files key stamps by it) */
  id: string;
  en: string;
  ko: string;
  ja: string;
  country: Country;
  season: Season;
  /** one short line for the map and the result sheet */
  postcard: string;
  /** ink colour for the place (stamp, map accents) */
  accent: string;
  focus: Focus;
}

type Row = [id: string, en: string, ko: string, ja: string, country: Country, accent: string, focus: Focus, postcard: string];

// Order matters: index % 4 is the season. Countries alternate in pairs per year
// of the route (KR JP KR JP, then JP KR JP KR), so neither country owns a season.
const ROWS: Row[] = [
  // 1–4
  ['gyeongju', 'Gyeongju', '경주', '慶州', 'KR', '#c0607a', 'basics', 'Cherry blossoms ring Bomun Lake and drift over the grassy royal tombs of old Silla.'],
  ['kamakura', 'Kamakura', '가마쿠라', '鎌倉', 'JP', '#5b6fa8', 'stones', 'In the June rains, hydrangeas crowd the temple lanes of Kamakura in blue and violet.'],
  ['seoraksan', 'Seoraksan', '설악산', '雪嶽山', 'KR', '#b4532f', 'leaves', 'Maples blaze along the granite ridges of Seoraksan, above the harbour city of Sokcho.'],
  ['shirakawago', 'Shirakawa-go', '시라카와고', '白川郷', 'JP', '#4f6f8f', 'snow', 'Steep thatched roofs rise out of deep snow, built at that pitch to shed it.'],
  // 5–8
  ['yoshino', 'Yoshino', '요시노', '吉野', 'JP', '#c86f86', 'lucky', 'Some thirty thousand cherry trees climb Mount Yoshino in waves of pale pink.'],
  ['boseong', 'Boseong', '보성', '寶城', 'KR', '#4f7d4a', 'mix', 'Rows of green tea curve around the hills of Boseong like lines on a map.'],
  ['kyoto', 'Kyoto', '교토', '京都', 'JP', '#a8442e', 'knots', 'Autumn maples frame the bamboo groves and the long Togetsukyo bridge at Arashiyama.'],
  ['pyeongchang', 'Pyeongchang', '평창', '平昌', 'KR', '#4d6a86', 'snow', 'Snow lies deep on the high meadows of Daegwallyeong, where the wind seldom rests.'],
  // 9–12
  ['jeju', 'Jeju', '제주', '濟州', 'KR', '#c29a2a', 'wind', 'Yellow canola flowers sway in the island wind below the slopes of Hallasan.'],
  ['yakushima', 'Yakushima', '야쿠시마', '屋久島', 'JP', '#3f6e55', 'mix', 'Summer rain keeps moss on every stone in the ancient cedar forests of Yakushima.'],
  ['andong', 'Andong Hahoe', '안동 하회', '安東 河回', 'KR', '#9a5a2f', 'gates', 'Mask dancers perform each autumn in Hahoe, a village held in a bend of the river.'],
  ['sapporo', 'Sapporo', '삿포로', '札幌', 'JP', '#557ea0', 'snow', 'Each February, snow sculptures line Odori Park for the Sapporo Snow Festival.'],
  // 13–16
  ['hirosaki', 'Hirosaki', '히로사키', '弘前', 'JP', '#c46a7f', 'wind', 'Fallen cherry petals drift on Hirosaki’s castle moat until the water turns pink.'],
  ['damyang', 'Damyang', '담양', '潭陽', 'KR', '#567f3e', 'fences', 'The bamboo grove of Juknokwon keeps a cool green shade all summer long.'],
  ['nikko', 'Nikko', '닛코', '日光', 'JP', '#b0502d', 'leaves', 'Maples redden along the hairpin bends of the Irohazaka road above Nikko.'],
  ['pohang', 'Pohang', '포항', '浦項', 'KR', '#b4573a', 'mix', 'On New Year’s morning, crowds at Homigot watch the first sunrise beside the bronze Hand of Harmony.'],
  // 17–20
  ['jinhae', 'Jinhae', '진해', '鎭海', 'KR', '#c55f7c', 'lucky', 'Every April, Jinhae’s streets and streams disappear under cherry blossom for the Gunhangje festival.'],
  ['naoshima', 'Naoshima', '나오시마', '直島', 'JP', '#c79a24', 'wind', 'On Naoshima, art waits among the beaches, including a yellow pumpkin beside the sea.'],
  ['suwon', 'Suwon', '수원', '水原', 'KR', '#9c6236', 'stones', 'Autumn light warms the stone walls of Hwaseong Fortress as they circle old Suwon.'],
  ['kanazawa', 'Kanazawa', '가나자와', '金沢', 'JP', '#4e6d8c', 'knots', 'In Kenroku-en, ropes called yukitsuri hold up the pine branches against the winter snow.'],
  // 21–24
  ['ashikaga', 'Ashikaga', '아시카가', '足利', 'JP', '#7a5aa0', 'mix', 'In late April, great wisteria at Ashikaga hang in long violet curtains.'],
  ['busan', 'Busan', '부산', '釜山', 'KR', '#3f78a0', 'wind', 'Summer crowds and sea breezes fill the long sands of Haeundae Beach.'],
  ['miyajima', 'Miyajima', '미야지마', '宮島', 'JP', '#b4432f', 'torii', 'At high tide the great vermilion torii of Itsukushima seems to float on the sea off Miyajima.'],
  ['seoul', 'Seoul', '서울', 'ソウル', 'KR', '#5a6680', 'snow', 'Snow settles on the curved palace roofs of Gyeongbokgung below the northern hills.'],
  // 25–28
  ['yeosu', 'Yeosu', '여수', '麗水', 'KR', '#b8383d', 'streams', 'Red camellias bloom in the woods of Odongdo, an island joined to Yeosu by a long breakwater.'],
  ['hakone', 'Hakone', '하코네', '箱根', 'JP', '#5f74a6', 'stones', 'Hydrangeas bloom beside the little mountain railway as it zigzags up to Hakone.'],
  ['jirisan', 'Jirisan', '지리산', '智異山', 'KR', '#a9542c', 'leaves', 'Autumn colour pours down Piagol valley on the slopes of Jirisan.'],
  ['hakodate', 'Hakodate', '하코다테', '函館', 'JP', '#47648a', 'mix', 'From Mount Hakodate, the winter city glitters on a narrow neck of land with the sea on both sides.'],
  // 29–32
  ['fujigoko', 'Fuji Five Lakes', '후지고코', '富士五湖', 'JP', '#c06a8e', 'wind', 'Fields of pink moss phlox spread beneath Mount Fuji near Lake Motosu.'],
  ['tongyeong', 'Tongyeong', '통영', '統營', 'KR', '#2f7a8a', 'knots', 'Small green islands scatter across the calm sea around Tongyeong’s harbour.'],
  ['takayama', 'Takayama', '다카야마', '高山', 'JP', '#b45a2c', 'lucky', 'Each October, lantern-hung festival floats roll through the old streets of Takayama.'],
  ['hwacheon', 'Hwacheon', '화천', '華川', 'KR', '#4b7194', 'snow', 'In January, families fish through holes in the frozen river at the Hwacheon ice festival.'],
  // 33–36
  ['gangneung', 'Gangneung', '강릉', '江陵', 'KR', '#c26a80', 'wind', 'Cherry trees ring Gyeongpo Lake, where poets once counted five moons in a single night.'],
  ['furano', 'Furano', '후라노', '富良野', 'JP', '#7b62a6', 'mix', 'In July, rows of lavender stripe the rolling hills of Furano in purple.'],
  ['jeonju', 'Jeonju', '전주', '全州', 'KR', '#b8892a', 'knots', 'Ginkgo leaves turn gold above the tiled roofs of Jeonju’s hanok village.'],
  ['beppu', 'Beppu', '벳푸', '別府', 'JP', '#7a6658', 'stones', 'Steam from thousands of hot springs drifts over Beppu in the cold air.'],
  // 37–40
  ['uji', 'Uji', '우지', '宇治', 'JP', '#4f7d45', 'mix', 'In late spring, the year’s first tea is picked on the green hills around Uji.'],
  ['buyeo', 'Buyeo', '부여', '扶餘', 'KR', '#c4607a', 'knots', 'In July, lotus flowers open across Gungnamji, a pond dug in the days of Baekje.'],
  ['oirase', 'Oirase', '오이라세', '奥入瀬', 'JP', '#b86a2a', 'leaves', 'Autumn leaves line the Oirase stream as it tumbles down from Lake Towada.'],
  ['taebaek', 'Taebaek', '태백', '太白', 'KR', '#4a6f95', 'snow', 'Snow sculptures and white peaks greet visitors to the Taebaeksan snow festival in January.'],
  // 41–44
  ['gwangyang', 'Gwangyang', '광양', '光陽', 'KR', '#b86a7a', 'wind', 'In March, white plum blossom covers the hillsides of Gwangyang’s Maehwa village.'],
  ['aomori', 'Aomori', '아오모리', '青森', 'JP', '#b9452f', 'lucky', 'In early August, giant glowing Nebuta lantern floats parade through Aomori.'],
  ['naejangsan', 'Naejangsan', '내장산', '內藏山', 'KR', '#b03f2c', 'leaves', 'Naejangsan’s maples are counted among the finest autumn colours in Korea.'],
  ['matsushima', 'Matsushima', '마쓰시마', '松島', 'JP', '#3e6a6c', 'knots', 'Pine-topped islets dot Matsushima Bay, dusted white on winter mornings.'],
  // 45–48
  ['himeji', 'Himeji', '히메지', '姫路', 'JP', '#c0708a', 'stones', 'Cherry blossom surrounds Himeji Castle, called the White Heron for its pale walls.'],
  ['namhae', 'Namhae', '남해', '南海', 'KR', '#3f7f6a', 'wind', 'Rice terraces step down to the sea at Darangee village on Namhae island.'],
  ['nara', 'Nara', '나라', '奈良', 'JP', '#a85230', 'mix', 'Deer wander beneath red maples in the wide lawns of Nara Park.'],
  ['deogyusan', 'Deogyusan', '덕유산', '德裕山', 'KR', '#557a9a', 'snow', 'Rime frost turns every tree white on the high summit ridge of Deogyusan.'],
  // 49–50
  ['gurye', 'Gurye', '구례', '求禮', 'KR', '#c4a02a', 'mix', 'In March, yellow sansuyu blossoms brighten the villages of Gurye at the foot of Jirisan.'],
  ['okinawa', 'Okinawa', '오키나와', '沖縄', 'JP', '#2f8a9a', 'mix', 'Clear turquoise water and coral reefs ring the islands of Okinawa.'],
];

export const ROUTE: RouteChapter[] = ROWS.map(([id, en, ko, ja, country, accent, focus, postcard], i) => ({
  id,
  en,
  ko,
  ja,
  country,
  season: (i % 4) as Season,
  postcard,
  accent,
  focus,
}));

export const ROUTE_CHAPTERS = ROUTE.length; // 50
export const ROUTE_LEVELS_PER_CHAPTER = 12;
/** Levels on one pass of the road (600). After that, Wanderer years reuse it. */
export const ROUTE_LEVELS = ROUTE_CHAPTERS * ROUTE_LEVELS_PER_CHAPTER;

export const SEASON_NAMES = [
  { en: 'Spring', ko: '봄', ja: '春' },
  { en: 'Summer', ko: '여름', ja: '夏' },
  { en: 'Autumn', ko: '가을', ja: '秋' },
  { en: 'Winter', ko: '겨울', ja: '冬' },
] as const;

export const COUNTRY_NAMES: Record<Country, { en: string; native: string }> = {
  KR: { en: 'Korea', native: '한국' },
  JP: { en: 'Japan', native: '日本' },
};

/** Where a Journey level sits on the road. */
export interface RoutePos {
  /** 0-based chapter count from level 1 (keeps growing past 50) */
  chapterIndex: number;
  /** 0-based place on the road (chapterIndex % 50) */
  index: number;
  /** 0 = the first pass; 1+ = Wanderer years */
  year: number;
  /** 0-based level slot inside the chapter (11 = festival board) */
  slot: number;
  chapter: RouteChapter;
}

export function routeOf(level: number): RoutePos {
  const n = Math.max(1, Math.floor(level));
  const chapterIndex = Math.floor((n - 1) / ROUTE_LEVELS_PER_CHAPTER);
  const index = chapterIndex % ROUTE_CHAPTERS;
  return {
    chapterIndex,
    index,
    year: Math.floor(chapterIndex / ROUTE_CHAPTERS),
    slot: (n - 1) % ROUTE_LEVELS_PER_CHAPTER,
    chapter: ROUTE[index],
  };
}

/** "Gyeongju · 경주 · 慶州" */
export const placeLine = (c: RouteChapter) => `${c.en} · ${c.ko} · ${c.ja}`;

/** "Gyeongju festival board" */
export const festivalTitle = (c: RouteChapter) => `${c.en} festival board`;

/** First level of a route chapter in a given year (1-based). */
export const chapterFirstLevel = (index: number, year = 0) =>
  (year * ROUTE_CHAPTERS + index) * ROUTE_LEVELS_PER_CHAPTER + 1;
