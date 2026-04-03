// scripts/seed-dev-data.mjs
// Writes 110 realistic transactions (2025-01 → 2026-03) to the live dev data folder.
// Run with: node scripts/seed-dev-data.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const dir = join(homedir(), 'Library/Application Support/Oursum/data/imports');
const file = join(dir, '2026-03-28-001.ndjson');

const T = (id, date, amount, description, category) => ({
  id,
  date,
  amount,
  description,
  category,
  accountId: '',
  importFile: '2026-03-28-001.ndjson',
  notes: '',
});

const rows = [
  // ── 2025 January ──
  T('2025-01-03|-52.40|Esselunga spesa settimanale|0','2025-01-03',-52.40,'Esselunga spesa settimanale','Groceries'),
  T('2025-01-07|-8.50|Metro Mensile|0','2025-01-07',-8.50,'Metro Mensile','Transport'),
  T('2025-01-10|-34.00|Trattoria da Mario|0','2025-01-10',-34.00,'Trattoria da Mario','Eating out'),
  T('2025-01-14|-9.99|Netflix abbonamento|0','2025-01-14',-9.99,'Netflix abbonamento','Entertainment'),
  T('2025-01-15|2800|Stipendio gennaio|0','2025-01-15',2800,'Stipendio gennaio','Others'),
  T('2025-01-18|-120.00|Visita medico specialista|0','2025-01-18',-120.00,'Visita medico specialista','Health'),
  T('2025-01-20|-48.30|Conad spesa|0','2025-01-20',-48.30,'Conad spesa','Groceries'),
  T('2025-01-25|-900.00|Affitto gennaio|0','2025-01-25',-900.00,'Affitto gennaio','Housing'),
  T('2025-01-28|-22.00|Pizzeria Bella Napoli|0','2025-01-28',-22.00,'Pizzeria Bella Napoli','Eating out'),
  // ── 2025 February ──
  T('2025-02-01|-55.10|Esselunga spesa|0','2025-02-01',-55.10,'Esselunga spesa','Groceries'),
  T('2025-02-05|-44.00|Carburante Agip|0','2025-02-05',-44.00,'Carburante Agip','Transport'),
  T('2025-02-08|-28.00|Sushi Zen cena|0','2025-02-08',-28.00,'Sushi Zen cena','Eating out'),
  T('2025-02-14|-150.00|Regalo San Valentino|0','2025-02-14',-150.00,'Regalo San Valentino','Entertainment'),
  T('2025-02-15|2800|Stipendio febbraio|0','2025-02-15',2800,'Stipendio febbraio','Others'),
  T('2025-02-20|-47.80|Conad spesa|0','2025-02-20',-47.80,'Conad spesa','Groceries'),
  T('2025-02-22|-900.00|Affitto febbraio|0','2025-02-22',-900.00,'Affitto febbraio','Housing'),
  T('2025-02-27|-35.00|Farmacia antibiotico|0','2025-02-27',-35.00,'Farmacia antibiotico','Health'),
  // ── 2025 March ──
  T('2025-03-03|-58.90|Esselunga spesa|0','2025-03-03',-58.90,'Esselunga spesa','Groceries'),
  T('2025-03-07|-12.00|Biglietto treno|0','2025-03-07',-12.00,'Biglietto treno','Transport'),
  T('2025-03-12|-19.00|Cinema 2 persone|0','2025-03-12',-19.00,'Cinema 2 persone','Entertainment'),
  T('2025-03-15|2800|Stipendio marzo|0','2025-03-15',2800,'Stipendio marzo','Others'),
  T('2025-03-15|-900.00|Affitto marzo|0','2025-03-15',-900.00,'Affitto marzo','Housing'),
  T('2025-03-18|-42.00|Cena con amici|0','2025-03-18',-42.00,'Cena con amici','Eating out'),
  T('2025-03-22|-51.20|Conad spesa|0','2025-03-22',-51.20,'Conad spesa','Groceries'),
  T('2025-03-28|-250.00|Visita odontoiatra|0','2025-03-28',-250.00,'Visita odontoiatra','Health'),
  // ── 2025 April ──
  T('2025-04-02|-49.60|Esselunga spesa|0','2025-04-02',-49.60,'Esselunga spesa','Groceries'),
  T('2025-04-06|-60.00|Carburante ENI|0','2025-04-06',-60.00,'Carburante ENI','Transport'),
  T('2025-04-10|-32.00|Aperitivo e cena|0','2025-04-10',-32.00,'Aperitivo e cena','Eating out'),
  T('2025-04-15|2800|Stipendio aprile|0','2025-04-15',2800,'Stipendio aprile','Others'),
  T('2025-04-15|-900.00|Affitto aprile|0','2025-04-15',-900.00,'Affitto aprile','Housing'),
  T('2025-04-20|-9.99|Spotify Premium|0','2025-04-20',-9.99,'Spotify Premium','Entertainment'),
  T('2025-04-24|-46.30|Conad spesa|0','2025-04-24',-46.30,'Conad spesa','Groceries'),
  // ── 2025 May ──
  T('2025-05-03|-53.70|Esselunga spesa|0','2025-05-03',-53.70,'Esselunga spesa','Groceries'),
  T('2025-05-07|-8.50|Metro Mensile|0','2025-05-07',-8.50,'Metro Mensile','Transport'),
  T('2025-05-12|-38.00|Ristorante Primavera|0','2025-05-12',-38.00,'Ristorante Primavera','Eating out'),
  T('2025-05-15|2800|Stipendio maggio|0','2025-05-15',2800,'Stipendio maggio','Others'),
  T('2025-05-15|-900.00|Affitto maggio|0','2025-05-15',-900.00,'Affitto maggio','Housing'),
  T('2025-05-19|-320.00|Occhiali da vista|0','2025-05-19',-320.00,'Occhiali da vista','Health'),
  T('2025-05-25|-75.00|Concerto jazz|0','2025-05-25',-75.00,'Concerto jazz','Entertainment'),
  T('2025-05-28|-44.90|Conad spesa|0','2025-05-28',-44.90,'Conad spesa','Groceries'),
  // ── 2025 June ──
  T('2025-06-02|-50.00|Esselunga spesa|0','2025-06-02',-50.00,'Esselunga spesa','Groceries'),
  T('2025-06-05|-55.00|Carburante Q8|0','2025-06-05',-55.00,'Carburante Q8','Transport'),
  T('2025-06-10|-45.00|Cena anniversario|0','2025-06-10',-45.00,'Cena anniversario','Eating out'),
  T('2025-06-15|3100|Stipendio giugno bonus|0','2025-06-15',3100,'Stipendio giugno + bonus','Others'),
  T('2025-06-15|-900.00|Affitto giugno|0','2025-06-15',-900.00,'Affitto giugno','Housing'),
  T('2025-06-20|-9.99|Netflix abbonamento|0','2025-06-20',-9.99,'Netflix abbonamento','Entertainment'),
  T('2025-06-24|-47.20|Lidl spesa|0','2025-06-24',-47.20,'Lidl spesa','Groceries'),
  // ── 2025 July ──
  T('2025-07-01|-43.80|Esselunga spesa|0','2025-07-01',-43.80,'Esselunga spesa','Groceries'),
  T('2025-07-05|-8.50|Metro Mensile|0','2025-07-05',-8.50,'Metro Mensile','Transport'),
  T('2025-07-10|-55.00|Cena in terrazza|0','2025-07-10',-55.00,'Cena in terrazza','Eating out'),
  T('2025-07-12|-1200.00|Vacanza agosto anticipo|0','2025-07-12',-1200.00,'Vacanza agosto anticipo','Entertainment'),
  T('2025-07-15|2800|Stipendio luglio|0','2025-07-15',2800,'Stipendio luglio','Others'),
  T('2025-07-15|-900.00|Affitto luglio|0','2025-07-15',-900.00,'Affitto luglio','Housing'),
  T('2025-07-22|-38.40|Conad spesa|0','2025-07-22',-38.40,'Conad spesa','Groceries'),
  // ── 2025 August ──
  T('2025-08-01|-35.00|Esselunga spesa ridotta|0','2025-08-01',-35.00,'Esselunga spesa ridotta','Groceries'),
  T('2025-08-10|-70.00|Cena resort|0','2025-08-10',-70.00,'Cena resort','Eating out'),
  T('2025-08-15|2800|Stipendio agosto|0','2025-08-15',2800,'Stipendio agosto','Others'),
  T('2025-08-15|-900.00|Affitto agosto|0','2025-08-15',-900.00,'Affitto agosto','Housing'),
  T('2025-08-20|-22.00|Farmacia crema solare|0','2025-08-20',-22.00,'Farmacia crema solare','Health'),
  T('2025-08-28|-29.90|Conad spesa|0','2025-08-28',-29.90,'Conad spesa','Groceries'),
  // ── 2025 September ──
  T('2025-09-02|-56.40|Esselunga spesa|0','2025-09-02',-56.40,'Esselunga spesa','Groceries'),
  T('2025-09-05|-45.00|Carburante IP|0','2025-09-05',-45.00,'Carburante IP','Transport'),
  T('2025-09-12|-33.00|Aperitivo e tapas|0','2025-09-12',-33.00,'Aperitivo e tapas','Eating out'),
  T('2025-09-15|2800|Stipendio settembre|0','2025-09-15',2800,'Stipendio settembre','Others'),
  T('2025-09-15|-900.00|Affitto settembre|0','2025-09-15',-900.00,'Affitto settembre','Housing'),
  T('2025-09-18|-9.99|Netflix abbonamento|0','2025-09-18',-9.99,'Netflix abbonamento','Entertainment'),
  T('2025-09-24|-49.70|Lidl spesa|0','2025-09-24',-49.70,'Lidl spesa','Groceries'),
  // ── 2025 October ──
  T('2025-10-01|-54.20|Esselunga spesa|0','2025-10-01',-54.20,'Esselunga spesa','Groceries'),
  T('2025-10-06|-8.50|Metro Mensile|0','2025-10-06',-8.50,'Metro Mensile','Transport'),
  T('2025-10-10|-40.00|Ristorante Osteria|0','2025-10-10',-40.00,'Ristorante Osteria','Eating out'),
  T('2025-10-15|2800|Stipendio ottobre|0','2025-10-15',2800,'Stipendio ottobre','Others'),
  T('2025-10-15|-900.00|Affitto ottobre|0','2025-10-15',-900.00,'Affitto ottobre','Housing'),
  T('2025-10-20|-180.00|Fisioterapia 3 sedute|0','2025-10-20',-180.00,'Fisioterapia 3 sedute','Health'),
  T('2025-10-25|-65.00|Teatro La Scala|0','2025-10-25',-65.00,'Teatro La Scala','Entertainment'),
  T('2025-10-28|-46.80|Conad spesa|0','2025-10-28',-46.80,'Conad spesa','Groceries'),
  // ── 2025 November ──
  T('2025-11-03|-57.60|Esselunga spesa|0','2025-11-03',-57.60,'Esselunga spesa','Groceries'),
  T('2025-11-07|-52.00|Carburante Agip|0','2025-11-07',-52.00,'Carburante Agip','Transport'),
  T('2025-11-11|-25.00|Burger e birra|0','2025-11-11',-25.00,'Burger e birra','Eating out'),
  T('2025-11-15|2800|Stipendio novembre|0','2025-11-15',2800,'Stipendio novembre','Others'),
  T('2025-11-15|-900.00|Affitto novembre|0','2025-11-15',-900.00,'Affitto novembre','Housing'),
  T('2025-11-22|-9.99|Spotify Premium|0','2025-11-22',-9.99,'Spotify Premium','Entertainment'),
  T('2025-11-28|-43.50|Lidl spesa|0','2025-11-28',-43.50,'Lidl spesa','Groceries'),
  // ── 2025 December ──
  T('2025-12-02|-59.80|Esselunga spesa|0','2025-12-02',-59.80,'Esselunga spesa','Groceries'),
  T('2025-12-07|-8.50|Metro Mensile|0','2025-12-07',-8.50,'Metro Mensile','Transport'),
  T('2025-12-12|-65.00|Cena natalizia|0','2025-12-12',-65.00,'Cena natalizia','Eating out'),
  T('2025-12-15|3300|Stipendio dicembre tredicesima|0','2025-12-15',3300,'Stipendio dicembre + tredicesima','Others'),
  T('2025-12-15|-900.00|Affitto dicembre|0','2025-12-15',-900.00,'Affitto dicembre','Housing'),
  T('2025-12-20|-350.00|Regali di Natale|0','2025-12-20',-350.00,'Regali di Natale','Entertainment'),
  T('2025-12-24|-75.00|Cena della vigilia|0','2025-12-24',-75.00,'Cena della vigilia','Eating out'),
  T('2025-12-27|-44.10|Conad spesa post-natale|0','2025-12-27',-44.10,'Conad spesa post-natale','Groceries'),
  // ── 2026 January ──
  T('2026-01-02|-61.20|Esselunga spesa|0','2026-01-02',-61.20,'Esselunga spesa','Groceries'),
  T('2026-01-06|-8.50|Metro Mensile|0','2026-01-06',-8.50,'Metro Mensile','Transport'),
  T('2026-01-10|-29.00|Pizzeria Roma|0','2026-01-10',-29.00,'Pizzeria Roma','Eating out'),
  T('2026-01-15|2800|Stipendio gennaio|0','2026-01-15',2800,'Stipendio gennaio','Others'),
  T('2026-01-15|-900.00|Affitto gennaio|0','2026-01-15',-900.00,'Affitto gennaio','Housing'),
  T('2026-01-18|-9.99|Netflix abbonamento|0','2026-01-18',-9.99,'Netflix abbonamento','Entertainment'),
  T('2026-01-22|-95.00|Visita cardiologo|0','2026-01-22',-95.00,'Visita cardiologo','Health'),
  T('2026-01-25|-48.30|Lidl spesa|0','2026-01-25',-48.30,'Lidl spesa','Groceries'),
  // ── 2026 February ──
  T('2026-02-03|-55.00|Esselunga spesa|0','2026-02-03',-55.00,'Esselunga spesa','Groceries'),
  T('2026-02-07|-48.00|Carburante ENI|0','2026-02-07',-48.00,'Carburante ENI','Transport'),
  T('2026-02-12|-36.00|Cena San Valentino|0','2026-02-12',-36.00,'Cena San Valentino','Eating out'),
  T('2026-02-15|2800|Stipendio febbraio|0','2026-02-15',2800,'Stipendio febbraio','Others'),
  T('2026-02-15|-900.00|Affitto febbraio|0','2026-02-15',-900.00,'Affitto febbraio','Housing'),
  T('2026-02-20|-120.00|Abbonamento palestra 3 mesi|0','2026-02-20',-120.00,'Abbonamento palestra 3 mesi','Health'),
  T('2026-02-24|-52.40|Conad spesa|0','2026-02-24',-52.40,'Conad spesa','Groceries'),
  T('2026-02-28|-35.00|Libro e riviste|0','2026-02-28',-35.00,'Libro e riviste','Entertainment'),
  // ── 2026 March ──
  T('2026-03-03|-58.70|Esselunga spesa|0','2026-03-03',-58.70,'Esselunga spesa','Groceries'),
  T('2026-03-07|-8.50|Metro Mensile|0','2026-03-07',-8.50,'Metro Mensile','Transport'),
  T('2026-03-12|-44.00|Ristorante Borghese|0','2026-03-12',-44.00,'Ristorante Borghese','Eating out'),
  T('2026-03-15|2800|Stipendio marzo|0','2026-03-15',2800,'Stipendio marzo','Others'),
  T('2026-03-15|-900.00|Affitto marzo|0','2026-03-15',-900.00,'Affitto marzo','Housing'),
  T('2026-03-18|-9.99|Netflix abbonamento|0','2026-03-18',-9.99,'Netflix abbonamento','Entertainment'),
  T('2026-03-22|-47.90|Lidl spesa|0','2026-03-22',-47.90,'Lidl spesa','Groceries'),
  T('2026-03-25|-28.00|Farmacia integratori|0','2026-03-25',-28.00,'Farmacia integratori','Health'),
];

const content = rows.map(r => JSON.stringify(r)).join('\n');
writeFileSync(file, content, 'utf-8');
console.log(`Written ${rows.length} rows to ${file}`);
