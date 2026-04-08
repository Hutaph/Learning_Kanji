import React from "react";
import { GitBranch, Mail, MapPin, Phone, Users, Video } from "lucide-react";

export function AppFooter() {
  const socialLinks = [
    { label: "Facebook", href: "https://www.facebook.com/htanphuoccter/", icon: Users },
    { label: "GitHub", href: "https://github.com/Hutaph/Learning_Kanji", icon: GitBranch },
    { label: "YouTube", href: "https://www.youtube.com/@huynhtanphuoccter", icon: Video }
  ];

  return (
    <footer className="appFooter">
      <div className="appFooterGrid">
        <section className="appFooterBlock">
          <h3>Mạng xã hội</h3>
          <div className="appFooterSocials">
            {socialLinks.map(({ label, href, icon: Icon }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="appFooterSocialBtn" title={label} aria-label={label}>
                <Icon size={18} />
              </a>
            ))}
          </div>
        </section>

        <section className="appFooterBlock">
          <h3>Liên hệ hỗ trợ</h3>
          <ul className="appFooterContacts">
            <li><MapPin size={16} />Số 69, Đường Skibidi Sigma, Phường Ohio Rizz, Quận Gyatt, Thành phố NPC Core, Quốc gia Internetverse</li>
            <li><Mail size={16} />skibidi.rizzlord42069@ohio-gyatt-sigma.brainrot</li>
            <li><Phone size={16} />+999 (404) 6967-363-4444</li>
          </ul>
        </section>
      </div>
      <p className="appFooterLegal">© {new Date().getFullYear()} Kulukulu Nihongo. Learn daily, skibidi daily.</p>
    </footer>
  );
}
