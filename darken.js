const fs = require('fs');

let content = fs.readFileSync('c:\\Desenvolvimento\\vendamais\\src\\components\\cotacoes\\cotacao-detalhes-client.tsx', 'utf-8');

const replacements = [
  [/text-neutral-900/g, 'text-white'],
  [/text-neutral-800/g, 'text-gray-200'],
  [/text-neutral-700/g, 'text-gray-300'],
  [/text-neutral-600/g, 'text-gray-400'],
  [/text-neutral-500/g, 'text-gray-400'],
  [/text-neutral-400/g, 'text-gray-500'],
  [/text-neutral-300/g, 'text-gray-600'],
  [/bg-white/g, 'bg-[#1F2937]'],
  [/bg-neutral-50\/50/g, 'bg-white/[0.02]'],
  [/bg-neutral-50/g, 'bg-[#1a2332]'],
  [/bg-neutral-100/g, 'bg-white/[0.08]'],
  [/bg-neutral-200/g, 'bg-white/[0.12]'],
  [/border-neutral-50/g, 'border-white/[0.04]'],
  [/border-neutral-100/g, 'border-white/[0.06]'],
  [/border-neutral-200/g, 'border-white/[0.08]'],
  [/divide-neutral-100/g, 'divide-white/[0.06]'],
  [/text-primary-600/g, 'text-indigo-400'],
  [/text-primary-500/g, 'text-indigo-500'],
  [/border-primary-500/g, 'border-indigo-500'],
  [/bg-primary-500/g, 'bg-indigo-600'],
  [/bg-primary-100/g, 'bg-indigo-500/20'],
  [/bg-primary-900/g, 'bg-[#1a2332]'],
  [/text-primary-200/g, 'text-indigo-200'],
  [/text-blue-600/g, 'text-blue-400'],
  [/bg-blue-50/g, 'bg-blue-500/10'],
  [/text-violet-600/g, 'text-violet-400'],
  [/bg-violet-50/g, 'bg-violet-500/10'],
  [/text-amber-600/g, 'text-amber-400'],
  [/bg-amber-50/g, 'bg-amber-500/10'],
  [/text-green-700/g, 'text-emerald-400'],
  [/text-green-600/g, 'text-emerald-400'],
  [/bg-green-100/g, 'bg-emerald-500/20'],
  [/bg-green-50\/40/g, 'bg-emerald-500/[0.05]'],
  [/bg-green-50\/10/g, 'bg-emerald-500/[0.02]'],
  [/border-green-300/g, 'border-emerald-500/30'],
  [/bg-neutral-900/g, 'bg-[#111827]'],
  [/border-neutral-800\/30/g, 'border-white/[0.08]']
];

for (const [regex, replacement] of replacements) {
  content = content.replace(regex, replacement);
}

fs.writeFileSync('c:\\Desenvolvimento\\vendamais\\src\\components\\cotacoes\\cotacao-detalhes-client.tsx', content);
console.log('Done replacing colors.');
