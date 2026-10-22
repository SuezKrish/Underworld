import type { Metadata } from 'next';
import './globals.css';
import './mobile.css';
import { BackgroundProvider } from './background-settings';
export const metadata: Metadata = {
    title: '隐秘世界 · 对战平台',
    description: '隐秘世界线上对战基础平台。创建房间，与朋友验证对战流程和规则时序。',
};
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) {
    return <html lang="zh-CN"><body><BackgroundProvider>{children}</BackgroundProvider></body></html>;
}
