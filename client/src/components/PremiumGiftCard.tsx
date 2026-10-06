import { formatNaira } from "@shared/marketplace";

type PremiumGiftCardProps = {
  amount: number;
  code?: string;
};

function finderCell(row: number, column: number, originRow: number, originColumn: number) {
  const distance = Math.max(Math.abs(row - originRow), Math.abs(column - originColumn));
  return distance === 0 || distance === 1 || distance === 3;
}

function qrModules(seed: string) {
  const size = 21;
  const modules = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const reserved = (row: number, column: number) => (
    (row < 8 && column < 8) ||
    (row < 8 && column >= size - 8) ||
    (row >= size - 8 && column < 8)
  );
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (reserved(row, column)) continue;
      const code = seed.charCodeAt((row * size + column) % seed.length);
      modules[row][column] = ((row * 11 + column * 7 + code) % 9) < 4;
    }
  }
  for (const [row, column] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        modules[row + y][column + x] = finderCell(row + y, column + x, row + 3, column + 3);
      }
    }
  }
  return modules;
}

function SmartChip() {
  return <svg className="gift-card-chip" viewBox="0 0 54 42" aria-hidden="true">
    <defs><linearGradient id="chip-gold" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff0a5" /><stop offset=".45" stopColor="#b8791d" /><stop offset="1" stopColor="#ffe18a" /></linearGradient></defs>
    <rect x="1" y="1" width="52" height="40" rx="8" fill="url(#chip-gold)" stroke="#fff1aa" strokeWidth="1" />
    <path d="M18 1v40M36 1v40M1 14h52M1 28h52M18 14h18v14H18z" fill="none" stroke="#94601b" strokeWidth="1.25" opacity=".85" />
  </svg>;
}

function QrVisual({ value }: { value: string }) {
  const modules = qrModules(value);
  return <svg className="gift-card-qr" viewBox="0 0 21 21" role="img" aria-label="Gift card verification QR code">
    <rect width="21" height="21" fill="white" />
    {modules.flatMap((row, rowIndex) => row.map((active, columnIndex) => active ? <rect key={`${rowIndex}-${columnIndex}`} x={columnIndex} y={rowIndex} width="1" height="1" fill="#071d13" /> : null))}
  </svg>;
}

export default function PremiumGiftCard({ amount, code = "ALPHA-9821-K89X-3300" }: PremiumGiftCardProps) {
  return <article className="premium-gift-card" aria-label={`${formatNaira(amount)} Alpha Market gift card`}>
    <div className="gift-card-surface">
      <div className="gift-card-topline">
        <div className="gift-card-brand"><span className="gift-card-brand-mark">A</span><span>ALPHA MARKET</span></div>
        <span className="gift-card-edition">DIGITAL EDITION</span>
      </div>
      <SmartChip />
      <div className="gift-card-value">{formatNaira(amount)}</div>
      <div className="gift-card-caption">A little joy, delivered instantly</div>
      <div className="gift-card-plaque">
        <div className="gift-card-code"><span>REDEEM CODE</span><strong>{code}</strong></div>
        <QrVisual value={`${amount}-${code}`} />
      </div>
      <span className="gift-card-glint" aria-hidden="true" />
    </div>
  </article>;
}
