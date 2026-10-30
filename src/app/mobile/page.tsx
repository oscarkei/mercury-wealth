import WealthPortal from '../../components/wealth-portal';
import MobilePreviewContent from '../../components/mobile-preview-content';

export default function Page(){
 return <MobilePreviewContent publicMock={process.env.VERCEL==='1'||process.env.MERCURY_PUBLIC_MOCK==='1'}><WealthPortal/></MobilePreviewContent>;
}
