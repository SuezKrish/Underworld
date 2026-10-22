import { plainCardText } from '../engine/card-text-format.mjs';
export function Rich({ text, name = false }: {
    text: string;
    name?: boolean;
}) { return name ? <>{text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}</> : <>{plainCardText(text)}</>; }
