// Original illustration for the sign-in screen: a small house and a
// shopping cart full of produce, joined by a dotted "home to shop" path.
// Drawn with simple SVG shapes so it is tiny, sharp at any size and works offline.
export default function GroceryScene() {
  return (
    <svg className="signin-scene" viewBox="0 0 520 380" role="img" aria-label="A small house and a shopping cart full of fruit and vegetables">
      <ellipse cx="260" cy="352" rx="250" ry="30" fill="#CDEFD9" fillOpacity="0.2"/>
      <path d="M150 336 C 205 372, 270 372, 330 340" fill="none" stroke="#F6D55C" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 12"/>
      <g transform="rotate(-18 70 80)">
        <ellipse cx="70" cy="80" rx="24" ry="17" fill="#F6D55C"/>
        <circle cx="46" cy="80" r="4" fill="#F6D55C"/>
        <circle cx="94" cy="80" r="4" fill="#F6D55C"/>
        <ellipse cx="62" cy="74" rx="8" ry="4" fill="#FFFFFF" fillOpacity="0.45"/>
      </g>
      <g>
        <rect x="243" y="62" width="10" height="26" rx="4" fill="#8FD18F"/>
        <circle cx="236" cy="58" r="12" fill="#3E9E52"/>
        <circle cx="260" cy="58" r="12" fill="#3E9E52"/>
        <circle cx="248" cy="46" r="13" fill="#5DBB63"/>
      </g>
      <g>
        <circle cx="468" cy="72" r="19" fill="#E4572E"/>
        <path d="M468 52 l4 7 l8 -1 l-5 6 l5 6 l-8 -1 l-4 7 l-4 -7 l-8 1 l5 -6 l-5 -6 l8 1 z" fill="#3E9E52"/>
        <ellipse cx="460" cy="78" rx="5" ry="3" fill="#FFFFFF" fillOpacity="0.4"/>
      </g>
      <circle cx="52" cy="318" r="19" fill="#3E9E52"/>
      <circle cx="76" cy="324" r="14" fill="#5DBB63"/>
      <rect x="168" y="138" width="22" height="46" rx="3" fill="#B8432A"/>
      <rect x="62" y="200" width="146" height="124" rx="6" fill="#FFFDF7"/>
      <path d="M44 212 L135 130 L226 212 Z" fill="#E4572E" stroke="#E4572E" strokeWidth="8" strokeLinejoin="round"/>
      <circle cx="135" cy="182" r="12" fill="#F6D55C"/>
      <path d="M118 324 V270 a18 18 0 0 1 36 0 V324 Z" fill="#0E5E63"/>
      <circle cx="146" cy="294" r="3" fill="#F6D55C"/>
      <g stroke="#0E5E63" strokeWidth="4">
        <rect x="76" y="230" width="30" height="30" rx="4" fill="#CDEFD9"/>
        <path d="M91 230 V260 M76 245 H106"/>
        <rect x="166" y="230" width="30" height="30" rx="4" fill="#CDEFD9"/>
        <path d="M181 230 V260 M166 245 H196"/>
      </g>
      <circle cx="338" cy="204" r="26" fill="#3E9E52"/>
      <circle cx="362" cy="194" r="22" fill="#5DBB63"/>
      <g transform="rotate(16 396 186)">
        <rect x="385" y="146" width="24" height="84" rx="12" fill="#E9B872"/>
        <path d="M391 166 l12 -6 M391 184 l12 -6 M391 202 l12 -6" stroke="#C98E45" strokeWidth="3" strokeLinecap="round"/>
      </g>
      <g stroke="#3E9E52" strokeWidth="4" strokeLinecap="round">
        <path d="M425 176 l-8 -22 M425 176 l0 -26 M425 176 l8 -22"/>
        <path d="M447 180 l-7 -20 M447 180 l1 -24 M447 180 l8 -19"/>
      </g>
      <rect x="416" y="174" width="18" height="44" rx="9" fill="#F29E4C"/>
      <rect x="438" y="178" width="18" height="40" rx="9" fill="#F29E4C"/>
      <circle cx="474" cy="200" r="18" fill="#E4572E"/>
      <path d="M474 182 l2 -9" stroke="#6B4226" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="482" cy="176" rx="7" ry="3.5" fill="#5DBB63" transform="rotate(-30 482 176)"/>
      <ellipse cx="467" cy="194" rx="5" ry="3" fill="#FFFFFF" fillOpacity="0.4"/>
      <path d="M318 210 q 38 26 80 2 q -40 14 -80 -2 z" fill="#F6D55C" stroke="#E2BE3E" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M300 214 L496 214 L474 300 L326 300 Z" fill="#FFFDF7" stroke="#FFFDF7" strokeWidth="6" strokeLinejoin="round"/>
      <g stroke="#9BD8C3" strokeWidth="3" strokeLinecap="round">
        <path d="M311 242 H486 M319 270 H479"/>
        <path d="M352 222 L357 292 M400 222 L400 292 M448 222 L443 292"/>
      </g>
      <path d="M326 300 L334 320 L470 320" fill="none" stroke="#FFFDF7" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M300 214 L284 176 L262 176" fill="none" stroke="#FFFDF7" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M252 176 H268" stroke="#F29E4C" strokeWidth="11" strokeLinecap="round"/>
      <circle cx="352" cy="338" r="15" fill="#0B4B4F" stroke="#FFFDF7" strokeWidth="5"/>
      <circle cx="352" cy="338" r="4" fill="#FFFDF7"/>
      <circle cx="452" cy="338" r="15" fill="#0B4B4F" stroke="#FFFDF7" strokeWidth="5"/>
      <circle cx="452" cy="338" r="4" fill="#FFFDF7"/>
    </svg>
  );
}
