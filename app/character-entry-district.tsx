import { hasCardType } from '../engine/card-types.mjs';
export const randomCharacterEntry = (card: any) => hasCardType(card, 'character') && (card.keywordStates?.find((k: any) => k.keyword === '混乱')?.present ?? card.keywords?.includes('混乱') ?? false);
export function CharacterEntryDistrict({ card, room, district, setDistrict, label = '进场地区', disabled = false, secretDeployment = false }: {
    card: any;
    room: any;
    district: number;
    setDistrict: (n: number) => void;
    label?: string;
    disabled?: boolean;
    secretDeployment?: boolean;
}) {
    const random = randomCharacterEntry(card), secretChoice = random && secretDeployment && !card.publicNow;
    const options = card.allowedDistricts ?? (room.districts ?? []).flatMap((d: any, i: number) => d ? [i] : []);
    return <>{random && !secretDeployment && <span>混乱 · 结算时随机决定进场地区</span>}{(!random || secretChoice) && <label>{secretChoice ? '秘密派遣地区' : ''}<select aria-label={secretChoice ? '秘密派遣地区' : label} value={district} disabled={disabled} onChange={e => setDistrict(Number(e.target.value))}>{options.map((i: number) => <option key={i} value={i}>地区 {room.districts[i]?.number ?? i + 1} · {room.districts[i]?.name}</option>)}</select></label>}</>;
}
