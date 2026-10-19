import type { Product } from '@/lib/types';

/**
 * Seed catalog chosen so every scenario in the task brief is reachable
 * without editing anything first.
 *
 * The HDMI entry is deliberately named and SKU'd `HDMI-cable` to match the
 * "Buy 4 items get a discount" campaign. Since matching is defined by the
 * campaigns themselves, every field here is editable in the UI.
 */
export const SEED_CATALOG: Product[] = [
  // games
  {
    id: 'game-zelda',
    name: 'The Legend of Zelda: Tears of the Kingdom',
    sku: 'GAME-ZELDA',
    price: 50,
    category: 'games',
    weight: 100,
    height: 15,
    width: 135,
    length: 170,
  },
  {
    id: 'game-spiderman',
    name: "Marvel's Spider-Man 2",
    sku: 'GAME-SPIDERMAN2',
    price: 60,
    category: 'games',
    weight: 100,
    height: 15,
    width: 135,
    length: 170,
  },
  {
    id: 'game-fc25',
    name: 'EA Sports FC 25',
    sku: 'GAME-FC25',
    price: 40,
    category: 'games',
    weight: 100,
    height: 15,
    width: 135,
    length: 170,
  },

  // console
  {
    id: 'console-ps5',
    name: 'PlayStation 5 Slim',
    sku: 'CONSOLE-PS5',
    price: 40,
    category: 'console',
    weight: 3200,
    height: 96,
    width: 358,
    length: 216,
  },
  {
    id: 'console-xbox',
    name: 'Xbox Series X',
    sku: 'CONSOLE-XBOXSX',
    price: 30,
    category: 'console',
    weight: 4450,
    height: 301,
    width: 151,
    length: 151,
  },
  {
    id: 'console-switch',
    name: 'Nintendo Switch OLED',
    sku: 'CONSOLE-SWITCH-OLED',
    price: 30,
    category: 'console',
    weight: 420,
    height: 102,
    width: 242,
    length: 14,
  },

  // cables
  {
    id: 'cable-hdmi',
    name: 'HDMI-cable',
    sku: 'HDMI-cable',
    price: 12,
    category: 'HDMI-cable',
    weight: 150,
    height: 40,
    width: 120,
    length: 120,
  },
  {
    id: 'cable-usbc',
    name: 'USB-C Cable 2m',
    sku: 'CABLE-USBC-2M',
    price: 10,
    category: 'HDMI-cable',
    weight: 90,
    height: 35,
    width: 110,
    length: 110,
  },

  // accessories
  {
    id: 'acc-mouse',
    name: 'Wireless Mouse',
    sku: 'ACC-MOUSE',
    price: 24,
    category: 'accessories',
    weight: 250,
    height: 45,
    width: 70,
    length: 120,
  },
  {
    id: 'acc-headphones',
    name: 'Over-Ear Headphones',
    sku: 'ACC-HEADPHONES',
    price: 70,
    category: 'accessories',
    weight: 600,
    height: 200,
    width: 180,
    length: 90,
  },
  {
    id: 'acc-batteries',
    name: 'AA Batteries (8-pack)',
    sku: 'ACC-BATTERIES-AA8',
    price: 8,
    category: 'accessories',
    weight: 200,
    height: 120,
    width: 90,
    length: 30,
  },
];
