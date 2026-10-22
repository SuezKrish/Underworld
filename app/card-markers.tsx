import { visibleCardMarkers } from '../engine/card-markers.mjs';
export function CardMarkers({ card }: {
    card: any;
}) {
    return <>{visibleCardMarkers(card).map(m => <span className='marker' key={m.key} title={m.description}>{m.label} {m.count}</span>)}</>;
}
