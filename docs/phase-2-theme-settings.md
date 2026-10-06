# Giai đoạn 2 — Theme Settings

Tài liệu này là contract của lớp cấu hình global cho Spinel Theme Base. Giai đoạn
này không định nghĩa visual identity cụ thể của thương hiệu và không tạo thêm
page-specific section. Các section hiện có chỉ được nối vào primitive/snippet
để kiểm chứng contract.

## Nguyên tắc chung

- Chỉ cấu hình trên Theme Editor; không hard-code giá trị thương hiệu trong
  section/page.
- Mọi setting được map thành CSS custom property trong
  snippets/css-variables.liquid. Fallback nằm cùng nơi để storefront vẫn render
  khi dữ liệu theme cũ thiếu key.
- Breakpoint chuẩn: Mobile <= 767.98px, Tablet 768–1149.98px, Desktop >=
  1150px.
- Root document dùng `font-size: 62.5%` để quy đổi ổn định `1rem = 10px`;
  các giá trị typography từ Theme Settings vẫn xuất bằng token riêng theo đơn
  vị px để không phụ thuộc vào root rem.
- ID đã tồn tại từ Skeleton Theme cho layout, typography và form được giữ
  nguyên; các màu legacy chỉ còn fallback trong Liquid, còn Theme Editor dùng
  `color_scheme_group` làm source of truth.
- Semantic HTML do component quyết định; Theme Settings chỉ điều khiển role
  visual/token. Không có setting đổi h1 thành h2 hoặc ngược lại.

## Dependency order

Logo -> Colors -> Layout -> Typography -> Motion & Reduced Motion -> Radius &
Shape -> Icons -> Button/Form -> Product components -> Overlay & Layering ->
Social Media

## Typography rule

Visual scale tách khỏi semantic HTML. Block không được tự tạo semantic heading
dựa trên setting. Block chỉ dùng role/token đã có:

- `.heading-text` kết hợp với `.heading-xs`, `.heading-sm`, `.heading-md`,
  `.heading-lg`, `.heading-xl` hoặc `.heading-display`.
- `.body-text` kết hợp với `.body-xs`, `.body-sm`, `.body-md`, `.body-lg`,
  `.body-xl` hoặc `.body-xxl`.
- `.accent-text`, `.eyebrow-text`, `.card-title-text` và `.card-price-text`
  cho các role chuyên biệt.

Text Block chỉ chọn body scale qua `text_size`; setting này không thay đổi
semantic HTML. Component vẫn dùng đúng element theo nội dung và accessibility
contract của nó.

## 1. Logo & Favicons

### Mục đích

Quản lý nhận diện cơ bản ở cấp document/header: logo mặc định, logo cho ngữ cảnh
overlay, kích thước responsive và favicon. Khi không có ảnh phù hợp, header dùng
shop.name làm text fallback.

### Theme Editor

Các setting nằm trong nhóm Logo & favicons. Favicon được khuyến nghị là ảnh
vuông; logo được giới hạn kích thước để không phá header.

### Consumer và file liên quan

- Logo: sections/header.liquid. Header có setting `header_overlay` để chọn ngữ cảnh
  overlay; khi bật, `logo_transparent` được ưu tiên và tự fallback về `logo`.
- Favicon: snippets/meta-tags.liquid.
- Kích thước: snippets/css-variables.liquid -> logo-width và logo-width-mobile;
  sections/header.liquid dùng hai token này cho layout và responsive image.
- CSS: sections/header.liquid và assets/critical.css.

### Responsive, accessibility và fallback

Logo dùng class `.site-logo` và modifier `.site-logo--transparent`. Desktop dùng
`--logo-width`, mobile dùng `--logo-width-mobile` và vẫn giới hạn tối đa 52vw.
`image_tag` render width/height metadata cùng responsive `srcset` để giảm layout
shift. Link logo có aria-label là shop.name. Thiếu ảnh dùng text shop.name;
thiếu width dùng 180px desktop hoặc 140px mobile. Favicon được xuất trực tiếp
trong head và bỏ qua nếu blank.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| logo | image_picker | image hoặc blank | blank | Render ở header; blank -> shop.name |
| logo_transparent | image_picker | image hoặc blank | blank | Dùng khi `header_overlay=true`; blank -> logo mặc định |
| logo_width | range | 80–400, step 4px | 180 | --logo-width desktop; max 45vw ở header |
| logo_width_mobile | range | 64–260, step 4px | 140 | --logo-width-mobile; max 52vw trên mobile |
| favicon | image_picker | image hoặc blank | blank | link rel=icon; blank -> không render |
| header_overlay | checkbox (Header section) | true / false | false | true -> class `.site-logo--transparent`; không có ảnh overlay -> logo mặc định |

### Tiêu chí nghiệm thu

- Logo và favicon thay đổi được trong Theme Editor.
- Header thường dùng logo mặc định; header overlay ưu tiên logo trong suốt và
  fallback đúng về logo mặc định.
- Header vẫn có tên shop có thể đọc bằng text khi logo trống.
- Không render `<img>` rỗng; logo có kích thước ổn định và không overflow trên
  mobile; link có accessible name.
- Favicon xuất hiện trong `<head>` khi có asset và không phụ thuộc CSS.

## 2. Colors / Scheme colors

### Mục đích

Đây là lớp màu global của theme. Merchant định nghĩa một nhóm scheme trong
Theme Editor; section/parent chọn scheme, còn block và component chỉ đọc semantic
token. Vì vậy cùng một component có thể đổi ngữ cảnh màu mà không đổi markup hay
hard-code màu thương hiệu.

### Theme Editor và ownership

- `color_schemes` dùng native `color_scheme_group`; mỗi scheme có content colors
  và ba button variants.
- `default_color_scheme` là scheme mặc định cho body/layout.
- Mỗi section có setting `color_scheme`; section/parent sở hữu context gần nhất.
- Component không suy đoán màu theo background. Block chỉ có thể chọn role rõ ràng
  (`scheme`, `heading`, `accent`, `highlight`); bỏ trống/`scheme` thì fallback về
  token của scheme.

### CSS Foundation và fallback

`snippets/css-variables.liquid` render `.scheme-1`, `.scheme-2`, `.scheme-3` và
đặt semantic token trên từng scope. Scheme lồng nhau kế thừa biến của ancestor,
nhưng `.scheme-*` gần component nhất thắng. Các alias cũ (`--color-background`,
`--color-foreground`, `--color-accent`) chỉ là compatibility layer; component
mới dùng semantic token trực tiếp.

Content token:

- `--background-color`, `--heading-color`, `--heading-highlight-color`;
- `--body-color`, `--accent-color`, `--border-color`, `--shadow-color`;
- `--sale-price-color`.

Button token:

- `--button-primary-*`, `--button-secondary-*`;
- `--button-tertiary-*`; tertiary là cấp độ thứ ba duy nhất, không dùng tên
  `Outline` hoặc `Subtle` trong contract.
- Primary và Secondary có background, label, border, hover background, hover
  label và hover border. Hover background để trống trong Editor nghĩa là
  `transparent`.
- Tertiary chỉ có label và hover label trong Editor; background, border, hover
  background và hover border luôn là giá trị nội bộ `transparent`.

Status colors không thuộc Color Scheme contract; Badges sở hữu token commerce
riêng ở mục 13: `--badge-sale-price`, `--badge-sale-background`,
`--badge-sale-color`, `--badge-sold-out-background` và
`--badge-sold-out-color`.

Alpha token `*-rgb` không được tạo mặc định; chỉ thêm khi component thực sự cần
alpha/overlay. Màu hard-code chỉ được phép trong palette mapping chức năng của
swatch hoặc fallback documented, không được dùng để thay semantic token.

### Consumer và file liên quan

- Schema/data: `config/settings_schema.json`, `config/settings_data.json`.
- Mapping và fallback: `snippets/css-variables.liquid`.
- Section context: toàn bộ `sections/*.liquid`; body mặc định ở
  `layout/theme.liquid` và `layout/password.liquid`.
- Primitive/consumer: `assets/critical.css`, `snippets/theme-button.liquid`,
  `blocks/text.liquid`, `snippets/badge.liquid`, `snippets/price.liquid`,
  `snippets/product-card.liquid`, header/footer/cart.

### Setting Contract

| ID | Type | Values | Default | Value mapping / constraint |
| --- | --- | --- | --- | --- |
| color_schemes | color_scheme_group | scheme-1, scheme-2, scheme-3 | Foundation palette | Group sở hữu toàn bộ content/button token; ID semantic ổn định |
| background | color | CSS color | #FFFFFF | `--background-color`; section gần nhất kế thừa |
| heading | color | CSS color | #1C1B1A | `--heading-color`; heading không tự tính màu |
| heading_highlight | color | CSS color | #A67C52 | `--heading-highlight-color` |
| text | color | CSS color | #1C1B1A | `--body-color`; paragraph/body fallback |
| accent | color | CSS color | #1C1B1A | `--accent-color`; eyebrow/label fallback |
| border | color | CSS color | #D7D0C8 | `--border-color` |
| shadow | color | CSS color | #1C1B1A | `--shadow-color` |
| sale_price | color | CSS color | #9A3D32 | `--sale-price-color` |
| button_primary_* | color | CSS color/blank hover background | Foundation primary | `--button-primary-*`; label và hover label là text token; state không dùng màu ngoài contract |
| button_secondary_* | color | CSS color/blank hover background | Foundation secondary | `--button-secondary-*` |
| button_tertiary_text | color | CSS color | #1C1B1A | `--button-tertiary-text`; Editor hiển thị Label |
| button_tertiary_hover_text | color | CSS color | #1C1B1A | `--button-tertiary-hover-text`; Editor hiển thị Hover label |
| default_color_scheme | color_scheme | scheme-1, scheme-2, scheme-3 | scheme-1 | Gắn vào body; không thay context của section có override |
| color_scheme (section) | color_scheme | scheme-1, scheme-2, scheme-3 | scheme-1 | Parent chọn scheme; component đọc scope gần nhất |
| color_role (text block) | select | scheme, heading, accent, highlight | scheme | Block override chỉ đổi màu của chính block; scheme giữ role mặc định |

### Responsive, accessibility và tiêu chí nghiệm thu

Scheme không đổi theo breakpoint; responsive chỉ thay đổi layout/size token.
Focus ring, disabled state, hover và text/button phải được kiểm tra contrast cho
từng scheme, đặc biệt scheme nền tối. Heading dùng `--heading-color`, text dùng
`--body-color`, eyebrow/label dùng `--accent-color` nếu block không override.

- Section đổi scheme độc lập mà không sửa markup component.
- Primary, Secondary và Tertiary render đúng default, hover, focus, disabled và
  contrast; Tertiary chỉ expose Label và Hover label; không xuất hiện
  Outline/Subtle hoặc Status colors trong contract.
- Block override chỉ tác động vùng được chọn và không phá nested scheme.
- Không render `*-rgb` nếu không có consumer alpha/overlay.
- Tên setting, token, class `.scheme-*` và fallback nhất quán giữa schema, Liquid,
  CSS và Theme Editor.

## 3. Layout

### Mục đích

Điều khiển container width và page margin theo từng breakpoint ở cấp toàn theme.
Section rhythm và grid gap vẫn dùng token Foundation với fallback ổn định, nhưng
không được expose trong nhóm Layout của Theme Editor ở contract này.

### Consumer và file liên quan

- Token: snippets/css-variables.liquid.
- Grid/container: assets/critical.css.
- Consumer trực tiếp: sections/collection.liquid, product.liquid,
  search.liquid, footer.liquid và các section dùng class shopify-section.

### Responsive, accessibility và fallback

`max_page_width` dùng các mốc px cố định để merchant đọc đúng giá trị render.
Mỗi breakpoint lấy `max(min_page_margin, device_margin)`, vì vậy minimum page
margin luôn là rào chắn cuối cùng khi merchant đặt margin theo thiết bị quá thấp.
Desktop dùng `layout_desktop_margin`, tablet dùng `layout_tablet_margin` và
mobile dùng `layout_mobile_margin`. Không dùng setting layout để ẩn nội dung
hoặc làm mất thứ tự đọc.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| max_page_width | select | 1200px, 1400px, 1600px, 1800px | 1600px | `--page-width`; giữ ID cũ |
| min_page_margin | range | 0–64, step 1px | 16 | `--page-margin-min`; minimum áp dụng ở mọi breakpoint |
| layout_desktop_margin | range | 16–96, step 1px | 48 | `--page-margin-desktop` từ 1150px |
| layout_tablet_margin | range | 16–64, step 1px | 30 | `--page-margin-tablet` từ 768px đến 1149.98px |
| layout_mobile_margin | range | 12–48, step 1px | 16 | `--page-margin-mobile` đến 767.98px |

### Tiêu chí nghiệm thu

- Container không vượt 1600px mặc định và không chạm viewport edge.
- Margin thực tế lần lượt là 48px desktop, 30px tablet và 16px mobile với
  minimum 16px.
- Layout không tạo horizontal overflow tại các mốc 767px, 768px, 1149px và
  1150px.

## 4. Typography

### Mục đích

Định nghĩa font family, body scale, sáu heading profile và eyebrow profile.
Theme Settings sở hữu visual scale, line-height, letter-spacing và text
transform; heading weight dùng base weight của font được chọn và không tạo
thêm một setting độc lập. Semantic HTML không bị điều khiển bởi các setting
này.

### Consumer và file liên quan

- Font-face và token: snippets/css-variables.liquid.
- Base typography: assets/critical.css.
- Role token: blocks/text.liquid, snippets/product-card.liquid,
  snippets/price.liquid, snippets/badge.liquid.
- Schema/labels: config/settings_schema.json và
  locales/en.default.schema.json.
- Font preload: layout/theme.liquid cho body font; heading/accent font được
  khai báo bằng `font_face` trong snippets/css-variables.liquid.

### Responsive, accessibility và fallback

Desktop dùng kích thước desktop từ 1150px; tablet dùng 87.5% kích thước
desktop từ 768px đến 1149.98px; mobile dùng kích thước mobile đến 767.98px.
Body scale giữ nguyên theo breakpoint và được tính từ base size. Font trống
fallback về body font đối với heading/accent, sau đó về system-ui. Font loading
dùng `font_display: swap`. Text transform không thay đổi accessible name.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| type_heading_font | font_picker | Shopify font | instrument_serif_n4 | `--font-heading-family`; blank -> body font |
| type_primary_font | font_picker | Shopify font | instrument_sans_n4 | `--font-body-family`; giữ ID body cũ; blank -> system stack |
| type_accent_font | font_picker | Shopify font | instrument_sans_n4 | `--font-accent-family`; blank -> body font |
| type_body_size | range | 14–20, step 1px | 14 | `--font-body-md`; xs/sm/lg/xl/xxl = base × 0.8, 0.9, 1.15, 1.3, 1.45 |
| type_body_leading | select | normal, relaxed, loose | loose | `--font-body-line-height` = 1.5, 1.6, 1.75 |
| type_letter_spacing | select | tight, normal, relaxed | normal | `--font-heading-letter-spacing` = -0.02em, 0em, 0.02em |
| type_heading_1_size_desktop | range | 40–96, step 4px | 72 | `--font-heading-display` từ 1150px |
| type_heading_1_size_mobile | range | 28–64, step 2px | 44 | `--font-heading-display` đến 767.98px |
| type_heading_1_line_height | select | tight, normal, relaxed | tight | `--font-heading-display-line-height` = 1.05, 1.15, 1.3 |
| type_heading_1_case | select | original, uppercase, capitalize | original | `--font-heading-display-text-transform` |
| type_heading_2_size_desktop | range | 32–72, step 4px | 48 | `--font-heading-xl` từ 1150px |
| type_heading_2_size_mobile | range | 24–48, step 2px | 32 | `--font-heading-xl` đến 767.98px |
| type_heading_2_line_height | select | tight, normal, relaxed | tight | `--font-heading-xl-line-height` = 1.05, 1.15, 1.3 |
| type_heading_2_case | select | original, uppercase, capitalize | original | `--font-heading-xl-text-transform` |
| type_heading_3_size_desktop | range | 28–60, step 4px | 40 | `--font-heading-lg` từ 1150px |
| type_heading_3_size_mobile | range | 22–40, step 2px | 28 | `--font-heading-lg` đến 767.98px |
| type_heading_3_line_height | select | tight, normal, relaxed | tight | `--font-heading-lg-line-height` = 1.05, 1.15, 1.3 |
| type_heading_3_case | select | original, uppercase, capitalize | original | `--font-heading-lg-text-transform` |
| type_heading_4_size_desktop | range | 24–48, step 4px | 32 | `--font-heading-md` từ 1150px |
| type_heading_4_size_mobile | range | 20–32, step 2px | 24 | `--font-heading-md` đến 767.98px |
| type_heading_4_line_height | select | tight, normal, relaxed | tight | `--font-heading-md-line-height` = 1.05, 1.15, 1.3 |
| type_heading_4_case | select | original, uppercase, capitalize | original | `--font-heading-md-text-transform` |
| type_heading_5_size_desktop | range | 18–36, step 2px | 24 | `--font-heading-sm` từ 1150px |
| type_heading_5_size_mobile | range | 16–28, step 2px | 20 | `--font-heading-sm` đến 767.98px |
| type_heading_5_line_height | select | tight, normal, relaxed | tight | `--font-heading-sm-line-height` = 1.05, 1.15, 1.3 |
| type_heading_5_case | select | original, uppercase, capitalize | original | `--font-heading-sm-text-transform` |
| type_heading_6_size_desktop | range | 16–30, step 2px | 20 | `--font-heading-xs` từ 1150px |
| type_heading_6_size_mobile | range | 14–24, step 2px | 18 | `--font-heading-xs` đến 767.98px |
| type_heading_6_line_height | select | tight, normal, relaxed | tight | `--font-heading-xs-line-height` = 1.05, 1.15, 1.3 |
| type_heading_6_case | select | original, uppercase, capitalize | original | `--font-heading-xs-text-transform` |
| type_eyebrow_size | range | 10–18, step 1px | 14 | `--font-eyebrow-size` |
| type_eyebrow_line_height | select | tight, normal, relaxed | tight | `--font-eyebrow-line-height` = 1.05, 1.25, 1.5 |
| type_eyebrow_letter_spacing | select | normal, relaxed, loose, extra_loose | extra_loose | `--font-eyebrow-letter-spacing` = 0em, 0.02em, 0.08em, 0.14em |
| type_eyebrow_case | select | original, uppercase | uppercase | `--font-eyebrow-text-transform` |

### Tiêu chí nghiệm thu

- Đổi Heading/Body/Accent font phản ánh ở đúng role token; font trống dùng
  fallback đã quy định.
- Giá trị mặc định trong Theme Editor khớp ảnh: body 14px/Loose, heading
  letter spacing Normal, H1–H6 lần lượt 72/48/40/32/24/20px desktop và
  44/32/28/24/20/18px mobile, tất cả Tight/Original; Eyebrow 14px,
  Tight/Extra loose/Uppercase.
- Block chỉ chọn role/scale; không setting nào đổi tag semantic.
- Text remains readable at mobile zoom 200% và không bị cắt do letter spacing.

## 5. Motion & Reduced Motion

### Mục đích

Chuẩn hóa motion contract dùng chung, ưu tiên phản hồi rõ ràng mà không làm
chậm tải, che khuất nội dung chính hoặc tạo layout shift.

### Consumer và file liên quan

- Settings: `config/settings_schema.json`, `config/settings_data.json` và
  `locales/en.default.schema.json`.
- Token mapping: `snippets/css-variables.liquid`.
- Foundation: `assets/critical.css` với `.motion-block`, product-card image
  zoom, button transition và `@media (prefers-reduced-motion: reduce)`.
- Block opt-in hiện tại: `blocks/text.liquid` và `blocks/group.liquid`; block
  mới phải thêm `.motion-block` có chủ đích, không gắn animation tự động cho
  mọi component.

### CSS Foundation

- Duration: `--motion-duration-fast`, `--motion-duration-standard` và
  `--motion-duration-slow`.
- Easing: `--motion-ease-standard`, `--motion-ease-emphasized` và
  `--motion-ease-linear`.
- Distance: `--motion-distance-hover` và `--motion-distance-block`.
- Behavior: `--motion-image-zoom`, `--motion-block-animations` và
  `--motion-block-animation`.
- Animation chỉ dùng `transform` và `opacity`; image zoom kích hoạt cho
  hover/focus-within trên desktop pointer và giữ `overflow` của media.
- Reduced motion override duration/animation/zoom/distance bằng media query,
  không cần thêm setting riêng hoặc JavaScript ép animation.

### Responsive, accessibility và fallback

Hai setting blank hoặc thiếu dữ liệu fallback về `true`. Image zoom không phải
tín hiệu duy nhất: card vẫn có focus-visible và secondary image dùng
`focus-within` khi component hỗ trợ. Mobile không phụ thuộc hover-only
information; reduced motion được áp dụng trên mọi breakpoint.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| motion_image_zoom | checkbox | true/false | true | `--motion-image-zoom` = 1.04 hoặc 1; product-card media image |
| motion_block_animations | checkbox | true/false | true | `.motion-block` dùng `--motion-block-animation`; false -> none |

Paragraph `motion_reduced_automatically` chỉ là helper trong Theme Editor,
không lưu giá trị. Reduced motion được xác định bằng
`prefers-reduced-motion: reduce`.

### Tiêu chí nghiệm thu

- Theme Editor hiển thị đúng hai toggle, cả hai bật mặc định, kèm helper text
  reduced motion như ảnh tham chiếu.
- Tắt image zoom loại bỏ scale ở product card; focus-visible và trạng thái
  secondary image vẫn rõ.
- Tắt block animations không làm block biến mất; nội dung vẫn server-rendered
  và đọc được khi JavaScript không có.
- `prefers-reduced-motion: reduce` tắt block animation, zoom và hover distance
  mà vẫn giữ các thay đổi trạng thái có ý nghĩa.
- Motion chỉ dùng opacity/transform, không gây layout shift hoặc chặn LCP.

## 6. Radius & Shape

### Mục đích

Định nghĩa preset shape dùng chung cho control, card, badge, swatch và overlay;
component không tự tạo scale radius riêng.

### Consumer và file liên quan

- Settings: config/settings_schema.json và config/settings_data.json.
- Token mapping: snippets/css-variables.liquid.
- Consumer: assets/critical.css, sections/header.liquid, sections/footer.liquid,
  sections/hello-world.liquid, snippets/theme-button.liquid, badge.liquid,
  variant-picker.liquid và swatch.liquid.

### Responsive, accessibility và fallback

Radius không đổi theo breakpoint; touch target không được giảm theo radius.
Các preset được map cố định về primitive token để focus, hover, disabled và
loading không làm thay đổi shape.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| radius_badges_subheadings | select | square, slightly_rounded, rounded, pill | square | `--badge-radius` và `--subheading-radius` |
| radius_variant_pickers | select | square, slightly_rounded, rounded, pill | square | `--variant-radius` |
| radius_swatches | select | square, slightly_rounded, rounded, pill | square | `--swatch-radius` |
| radius_navigation | select | square, slightly_rounded, rounded, pill | pill | `--navigation-radius` |
| radius_tags | select | square, slightly_rounded, rounded, pill | square | `--tag-radius` cho custom product-card tags |
| radius_media_containers | select | square, slightly_rounded, rounded, extra_rounded | square | `--card-radius` và `--media-radius`; media, product cards, pop-ups, popovers, blocks |
| radius_drawers | select | square, slightly_rounded, rounded, extra_rounded | square | `--drawer-radius` và default `--overlay-radius` |
| radius_bottom_sheets | select | square, slightly_rounded, rounded, extra_rounded | slightly_rounded | `--bottom-sheet-radius` |
| shape_border_width | range | 0–3, step 1px | 1 | Shared border primitive, không phải radius preset |

Primitive value mapping cố định:

- `square` → `--radius-square` → `0px`.
- `slightly_rounded` → `--radius-slight` → `4px`.
- `rounded` → `--radius-rounded` → `8px`.
- `pill` → `--radius-pill` → `1000px`; chỉ dùng cho control/tag phù hợp.
- `extra_rounded` → `--radius-extra` → `16px`; chỉ có ở media/container và
  overlay.

Button và Form vẫn dùng setting global của nhóm primitive hiện có, nhưng đều
map về cùng primitive: `button_radius_style` dùng `--button-radius`, còn
`input_radius_style` là `select` preset dùng `--input-radius`; không còn
numeric radius field. Product card không có setting radius riêng và kế thừa
`radius_media_containers`.

### Tiêu chí nghiệm thu

- Button/input/card/badge/variant/swatch/navigation/tag/overlay dùng đúng token
  semantic tương ứng.
- Đổi preset cập nhật tất cả consumer đã mapping mà không tạo radius hard-code
  theo section.
- `Pill` không bị dùng cho media/container hoặc overlay; `Extra rounded` không
  xuất hiện ở control/tag.
- Không tạo clipping làm mất focus ring.

## 7. Icons

### Mục đích

Chuẩn hóa độ dày nét, màu và semantics của icon; kích thước do component hoặc
context quyết định, không mở thêm global icon size trong Theme Editor.

### Consumer và file liên quan

- Token: snippets/css-variables.liquid.
- Library và markup: snippets/icon.liquid; các component dùng registry này thay vì
  tự viết SVG cho icon hành động.
- Nguồn icon: [Heroicons](https://heroicons.com/) v2 outline, MIT license. Chỉ
  chọn các icon phù hợp với UI hiện có: `arrow-left`, `arrow-right`, `bars-3`, `chevron-*`,
  `x-mark`, `magnifying-glass`, `shopping-bag`, `shopping-cart`, `user`,
  `truck`, `tag`, `trash`, `document-text`, `receipt-percent`, `share`, `play`,
  `pause`, `plus`, `minus` và `check`.
- CSS wrapper: `.icon` trong assets/critical.css và header component.

### Responsive, accessibility và fallback

Icon-only link phải có `aria-label` hoặc visually-hidden text; icon decorative
dùng `aria-hidden="true"`. Header dùng semantic size large và touch target tối
thiểu 44px trên mobile. SVG kế thừa `currentColor` từ scheme, có `viewBox`
hợp lệ và không được làm overflow container.
- Mọi icon hành động mới phải đi qua `{% render 'icon' %}` và lấy key từ
  registry Heroicons. Không dùng ký tự Unicode (ví dụ `›`, `‹`, `×`) làm icon,
  không tạo SVG inline trùng lặp trong component, và không đổi sang filled/duotone
  nếu context đang dùng outline.
- `custom` SVG chỉ dành cho brand mark hoặc biểu tượng không có bản tương đương
  trong Heroicons; không dùng nó để thay thế một action icon đã có trong registry.
- `circle`, `square`, `triangle` và `diamond` chỉ là shape trang trí của Eyebrow;
  không coi chúng là icon hành động và không dùng chúng thay cho icon Heroicons.
- Khi component cần đặt icon bên trong một wrapper đã có sẵn, dùng tham số
  `bare: true`; wrapper/link và accessible name vẫn do component sở hữu.
- Các alias cũ (`arrow`, `cart`, `account`, `menu`, `close`, ...) chỉ giữ để
  tương thích dữ liệu Theme Editor cũ; setting mới luôn chọn key Heroicons
  canonical.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| icon_thickness | range | 80–160, step 5% | 120 | `--icon-thickness` là hệ số; `--icon-stroke-width` = hệ số × base stroke 1.5 |

`--icon-size-small`, `--icon-size-medium` và `--icon-size-large` là token
context cố định của component, không phải setting global. Icon key, trạng thái
hiển thị và business logic do Liquid/component quyết định; CSS chỉ trình bày.

### Tiêu chí nghiệm thu

- Theme Editor chỉ hiển thị một control `Icon thickness`, đơn vị `%`, mặc định
  `120%`.
- Thay đổi thickness cập nhật nhất quán các SVG dùng `--icon-stroke-width`;
  màu kế thừa scheme hiện hành và focus-visible không bị mất.
- Account/cart có accessible name; icon decorative không bị screen reader đọc
  như nội dung độc lập.
- Kích thước/touch target thuộc context header hoặc button, không bị thay đổi
  bởi setting global mới; SVG không méo, không overflow ở mobile.

## 8. Buttons

### Mục đích

Chuẩn hóa button/link CTA theo ba cấp độ Primary, Secondary và Tertiary. Theme
Settings sở hữu kích thước responsive, typography, radius và state; scheme hiện
hành sở hữu màu. Primitive không quyết định label hay semantic action.

### Consumer và file liên quan

- Contract mapping: snippets/css-variables.liquid.
- Markup: snippets/theme-button.liquid.
- CSS/focus/motion: assets/critical.css.
- Existing consumers: product.liquid, search.liquid, cart.liquid.
- Direct class consumers: password.liquid và cart.liquid dùng `.btn` cùng
  modifier tương ứng.

### Responsive, accessibility và fallback

Desktop/tablet dùng height và horizontal padding desktop; mobile dùng token
mobile. Tất cả variant dùng cùng kích thước chung, bao gồm Tertiary. Loading
giữ label trong layout và đặt spinner absolute nên không đổi chiều rộng.
Focus-visible luôn có outline; disabled dùng opacity contract. Link dùng
anchor, action dùng button. Text case chỉ là presentation và không đổi
accessible name.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| button_radius_style | select | square, rounded, pill | square | `--button-radius` = `--radius-square`, `--radius-rounded`, `--radius-pill` |
| button_height_desktop | range | 40–64, step 1px | 48 | `--button-height` từ 1150px và tablet |
| button_height_mobile | range | 40–56, step 1px | 44 | `--button-height-mobile` đến 767.98px |
| button_padding_inline_desktop | range | 12–32, step 1px | 28 | `--button-padding-inline-desktop` từ 768px |
| button_padding_inline_mobile | range | 12–32, step 1px | 24 | `--button-padding-inline-mobile` đến 767.98px |
| button_disabled_opacity | range | 0–100, step 1% | 60 | `--button-disabled-opacity` = percentage / 100 |
| button_font_size | select | 10px, 12px, 14px, 16px | 12px | `--button-font-size`; shared Button label role |
| button_letter_spacing | select | normal, relaxed, loose, extra_loose | extra_loose | `--button-letter-spacing` = 0em, 0.02em, 0.08em, 0.14em |
| button_primary_font | select | body, heading | body | `--button-primary-font-family` |
| button_primary_text_case | select | original, uppercase | uppercase | `--button-primary-text-case` |
| button_primary_border_width | range | 0–3, step 1px | 1 | `--button-primary-border-width` và modifier `--button-border-width` |
| button_secondary_font | select | body, heading | body | `--button-secondary-font-family` |
| button_secondary_text_case | select | original, uppercase | uppercase | `--button-secondary-text-case` |
| button_secondary_border_width | range | 0–3, step 1px | 1 | `--button-secondary-border-width` và modifier `--button-border-width` |
| button_tertiary_font | select | body, heading | body | `--button-tertiary-font-family` |
| button_tertiary_text_case | select | original, uppercase | uppercase | `--button-tertiary-text-case` |
| button_tertiary_show_underline | checkbox | true/false | true | `--button-tertiary-text-decoration` = underline/none |
| button_tertiary_underline_offset | range | 0–8, step 1px | 3 | `--button-tertiary-underline-offset` |

### Tiêu chí nghiệm thu

- Tất cả CTA primitive dùng `.btn`, `.btn--primary`, `.btn--secondary` hoặc
  `.btn--tertiary`; không còn hard-code sizing theo section.
- `btn--icon` và `btn--unstyled` là utility modifier; variant rỗng hoặc sai
  fallback về Primary.
- Keyboard focus rõ, disabled không submit và disabled opacity là 60% mặc
  định.
- Loading giữ nguyên kích thước/chiều rộng, spinner không thay thế accessible
  label.
- Tertiary bật/tắt underline và điều chỉnh được offset.

## 9. Forms

### Mục đích

Chuẩn hóa input, select, textarea và nhóm field để mọi form dùng cùng kích thước,
typography, semantic color token và trạng thái keyboard-accessible.

### Consumer và file liên quan

- Theme Editor contract: config/settings_schema.json, config/settings_data.json.
- Token mapping: snippets/css-variables.liquid.
- CSS foundation: assets/critical.css.
- Reusable markup: snippets/form-field.liquid.
- Consumers: sections/search.liquid, product.liquid, article.liquid,
  password.liquid, cart.liquid, snippets/variant-picker.liquid.

### Responsive, accessibility và fallback

Input và select dùng `--input-height` trên desktop/tablet và
`--input-height-mobile` trên mobile; textarea giữ min-height riêng để không bị
ép thành single-line control. `--input-radius`, `--input-border-width` và
`--input-background-color` được dùng thống nhất cho control contract.

Markup chuẩn dùng `.form__wrapper`, `.form__fields`, `.form__field` và
`.form__control`, với modifier theo loại control và error state. Label luôn gắn
`for`/`id`; helper và error được nối bằng `aria-describedby`, error set
`aria-invalid="true"` và `role="alert"`. Error dài được phép wrap bằng
`overflow-wrap: anywhere`; focus-visible dùng focus rule chung của theme.

Border, focus và error không có color picker riêng trong Form: component đọc
`--border-color`, `--accent-color` và `--sale-price-color` của scheme gần nhất.
`--sale-price-color` là fallback semantic hiện có cho error vì status color
settings đã được loại khỏi contract Colors.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| input_style | select | solid, outline | solid | `input-style--solid` / `input-style--outline` đặt `--input-background-color` |
| input_height_desktop | range | 40–64, step 1px | 48 | `--input-height` |
| input_height_mobile | range | 40–56, step 1px | 44 | `--input-height-mobile` |
| input_radius_style | select | square, slightly_rounded, rounded, pill | rounded | `--input-radius` dùng primitive radius chung; không còn numeric radius field |
| input_border_width | range | 0–3, step 1px | 1 | `--input-border-width-outline`; Solid đặt `--input-border-width` về 0px |
| form_label_typography | select | xs, sm, md, lg, xl, xxl | md | `--form-label-font-size`; dùng cùng scale `Text size` của Text block |
| form_input_typography | select | xs, sm, md, lg, xl, xxl | md | `--form-input-font-size`; không đổi layout control |
| form_helper_typography | select | xs, sm, md, lg, xl, xxl | md | `--form-helper-font-size` |
| form_error_typography | select | xs, sm, md, lg, xl, xxl | md | `--form-error-font-size` |

Semantic token mapping cố định:

- `--input-text-color` → `--body-color`.
- `--input-border-color` → `--border-color`.
- `--input-focus-color` → `--accent-color`.
- `--input-error-color` → `--sale-price-color`.
- `--input-background-color` lấy từ Form setting khi Solid; Outline dùng
  `transparent` mà không sửa giá trị merchant đã nhập.

Giá trị legacy `input_height` (nếu store cũ còn lưu) chỉ được dùng làm fallback
cho desktop: compact = 40px, standard = 48px, large = 56px. Các setting
`input_border_color`, `input_focus_color` và `form_label_case` không còn render
trong Theme Editor; scheme semantic token là ownership mới.
Các giá trị legacy `body-sm`, `body-md` và `body-lg` của bốn setting Typography
vẫn được map tương ứng khi store cũ còn lưu.

### Tiêu chí nghiệm thu

- Theme Editor hiển thị đúng Solid/Outline, 48/44px, 8px, 1px, #FFFFFF,
  Typography và bốn role `md` theo mặc định.
- Search, product, article comment, password và cart form dùng cấu trúc form
  chuẩn; input/select/textarea không phá layout trên mobile.
- Input settings không làm checkbox/radio thành full-width text input; tất cả
  control dùng chung border, radius, typography và focus contract.
- Label, helper, error có quan hệ ngữ nghĩa đúng; error/disabled state vẫn nhận
  biết được ngoài màu và không phụ thuộc JavaScript để render style.

## 10. Product cards

### Mục đích

Product card là kernel dùng lại cho collection, search, recommendation và các
product representation khác. Card không chứa logic grid của section; section
chỉ cung cấp product object và class ngữ cảnh.

### Theme Editor và ownership

- `Product cards` là nhóm global trong `config/settings_schema.json`.
- `product_card_color_scheme` sở hữu scheme của toàn card.
- `product_card_quick_add_color_scheme` là scheme độc lập của quick-add button;
  nó không thay đổi scheme nội dung card.
- `product_card_gap_device` chỉ quyết định nhóm range nào hiển thị trong Editor;
  desktop/tablet và mobile vẫn được render thành hai token responsive.
- Swatches global sở hữu visual/data fallback cho variant picker. Product card
  giữ contract riêng với prefix `product_card_swatch_*` và chỉ remap token
  `--swatch-*` trong phạm vi card.

### Markup, component và file liên quan

- Kernel: `snippets/product-card.liquid`.
- Swatch composition: `snippets/product-card-swatches.liquid` và
  `snippets/swatch.liquid`.
- Shared primitives: `snippets/image.liquid`, `snippets/price.liquid`,
  `snippets/badge.liquid`, `snippets/theme-button.liquid`.
- Consumers: `sections/collection.liquid`, `sections/search.liquid`; các
  recommendation/product grids có thể render cùng snippet mà không copy markup.
- Tokens: `snippets/css-variables.liquid`; foundation CSS: `assets/critical.css`.

Markup dùng BEM ổn định: `.product-card`, `.product-card--standard`,
`.product-card--card`, `__media`, `__content`, `__details`, `__title`,
`__price`, `__swatches`, `__badges`, `__quick-add` và `__quick-view`.

### Cấu hình và runtime của Swatches

Nhóm `Swatches` nằm bên trong category `Product cards` điều khiển riêng swatch
trên product card. Category `Swatches` độc lập trong Theme Settings điều khiển
variant picker trên trang sản phẩm; hai nhóm dùng cùng primitive hình ảnh/màu
`snippets/swatch.liquid` nhưng có setting và token riêng.

Luồng setting đi theo thứ tự:

1. `config/settings_schema.json` khai báo `product_card_swatches_enabled` và
   các setting `product_card_swatch_*` trong category `Product cards`.
2. `snippets/product-card.liquid` ẩn/hiện swatches và đặt chúng ở đầu hoặc
   cuối vùng nội dung theo setting `position`.
3. `snippets/product-card-swatches.liquid` chọn option có Shopify swatch data,
   sau đó dùng option `Color` làm fallback; đoạn này áp kiểu, giới hạn số giá
   trị, URL variant và số lựa chọn còn lại `+N`.
4. `snippets/swatch.liquid` vẽ màu hoặc ảnh. Shopify swatch data được ưu tiên;
   màu theo tên và bề mặt trung tính là fallback khi thiếu màu/ảnh.
5. `snippets/css-variables.liquid` đưa gap, width desktop/mobile và ratio vào
   token. `assets/critical.css` dùng các token này cho `.product-card__swatches`
   và `.product-card__swatch-box`; breakpoint mobile đổi width sang token mobile.
6. `assets/product-card-variants.js` định nghĩa
   `swatches-variant-picker-component`; sự kiện `change` của radio cập nhật
   giá, ảnh chính/ảnh phụ, link và variant id của card. Giá trị thuộc sản phẩm
   khác hoặc thiếu variant nội bộ đi tới URL Shopify lưu trên radio. Nút `+N`
   mở Quick Add; khi card không có Quick Add, nó đi tới trang sản phẩm.

Markup theo theme mẫu là custom element chứa `form > ul > li > label`, trong
label có `input[type=radio]`, swatch trực quan và tên ẩn cho trình đọc màn hình.
`ul` dùng class `.product-card__swatches`; các `template` giá/ảnh là anh em
của `form` bên trong custom element, để giữ cây `ul` hợp lệ. Radio chưa được
chọn khi card tải lần đầu, tương tự mẫu; chọn radio làm nổi trạng thái theo
`product_card_swatch_selected_style`. Nếu vượt giới hạn, một `li` cuối chứa
nút `+N`. `position: top` đặt nhóm trước tiêu đề/giá; `position: bottom` đặt
nhóm sau chi tiết sản phẩm. Khi `+N` mở Quick Add, nút mang class
`btn--loading`, ẩn mờ nhãn `+N` và hiển thị một chấm nảy 7px trong lúc nội dung
sản phẩm được tải; trạng thái loading hiển thị trên `+N`. Nhãn `+N` dùng
typography, màu chữ và text case theo button tertiary trong Theme Settings.
Gạch chân không hiện sẵn; khi hover nó chạy vào và vẫn theo setting
`Show underline`.

Trong product card, option value hết hàng vẫn hiện nhưng radio bị disabled và
được đọc cùng nhãn “Sold out”. Swatch giữ nguyên màu/ảnh, có hai nét strike
SVG từ góc trên trái xuống góc dưới phải như cấu trúc `variant-strike` của
theme mẫu; không làm mờ toàn bộ swatch bằng opacity.

Với `Selected variant style = Underline`, CSS theme mẫu đặt `padding-bottom:
5px` trên từng `li` (kể cả `li[slot="more"]`) và vẽ đường 1px ở đáy `li` của
radio đang chọn, dùng màu heading. Swatch không có viền chọn hay viền trong;
ô trắng vẫn giữ viền mờ để nhìn thấy trên nền trắng. Vì đường gạch thuộc `li`,
nó nằm dưới ô màu thay vì phủ lên ô màu.

Cấu trúc HTML rút gọn:

```html
<swatches-variant-picker-component class="product-card__swatches-variant-picker" data-product-url="/products/item">
  <form autocomplete="off">
    <ul class="product-card__swatches product-card__swatches--selected-border" data-product-card-swatches>
      <li class="product-card__swatch-item">
        <label class="product-card__swatch-label">
          <input type="radio" value="Black" data-variant-id="123" data-product-url="/products/item?variant=123" data-product-card-swatch>
          <span class="swatch swatch--color product-card__swatch-box" aria-hidden="true"></span>
          <span class="visually-hidden">Black</span>
        </label>
      </li>
      <li class="product-card__swatch-more" slot="more">
        <button type="button" class="product-card__swatch-count btn btn-tertiary btn--tertiary" data-product-card-swatch-more aria-label="Show all options">
          <span class="product-card__swatch-count-label btn__text">+N</span>
          <span class="bouncing-dots hidden" data-loading-dots aria-hidden="true"><span></span></span>
        </button>
      </li>
    </ul>
  </form>
  <template data-product-card-variant="123">…</template>
</swatches-variant-picker-component>
```

Khi option có dữ liệu swatch chuẩn Shopify, card chỉ tính các value có swatch;
option `Color` legacy không có dữ liệu này thì dùng toàn bộ value. Vì thế
product mẫu Oxygen có Black, Red và Blue phù hợp: hiển thị hai ô và `+1`.
`+N` chỉ được render khi số value phù hợp vượt giới hạn cấu hình.

### CSS Foundation, responsive và fallback

- `--product-card-*` là namespace duy nhất cho title, ratio, layout, spacing, quick
  add/view và swatches. Card kế thừa semantic color, typography, button, radius
  và price token của scheme gần nhất.
- Ảnh dùng `image_url`/`image_tag` với width/height theo ratio; khi thiếu ảnh,
  card dùng product placeholder, còn title/price vẫn render bình thường.
- Secondary image chỉ là enhancement hover/focus trên pointer phù hợp và bị tắt
  trên mobile. Quick add dùng form POST native tới `routes.cart_add_url`, quick
  view dùng link product native; data hooks chỉ để JavaScript hydrate về sau.
- Breakpoint chung: desktop/tablet dùng `--product-card-*`, mobile dùng các biến
  `*-mobile` tại `max-width: 767.98px`. Không có width/gap riêng theo section.
- Không có swatch option phù hợp thì `__swatches` không render; variant image
  fallback về color swatch. Unknown color dùng neutral surface nhưng vẫn có
  accessible name.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| product_card_style | select | standard, card | standard | Modifier `product-card--standard/card`; fallback standard |
| product_card_border_width | range | 0–3, step 1px | 0 | `--product-card-border-width` |
| product_card_shadow | select | none, soft, strong | none | `--product-card-shadow`; preset chỉ dùng semantic shadow token |
| product_card_color_scheme | color_scheme | scheme group | scheme-1 | Class `scheme-*`; card scheme ownership |
| product_card_title_font | select | display, heading, body | display | `--product-card-title-font-family`; Display/Heading -> heading family |
| product_card_title_size_desktop | range | 12–40, step 1px | 20 | `--product-card-title-size` |
| product_card_title_size_mobile | range | 12–32, step 1px | 18 | `--product-card-title-size-mobile` |
| product_card_alignment | select | left, center, right | left | `--product-card-alignment`; title, price, swatches cùng alignment |
| product_card_title_line_limit | select | none, 1, 2, 3 | none | `--product-card-title-line-limit` và line-clamp modifier |
| product_card_ratio | select | natural, square, portrait, landscape | natural | `--product-card-image-ratio`; Original giữ intrinsic ratio |
| product_card_gap_device | select | desktop, mobile | desktop | Chọn nhóm range trong Editor |
| product_card_content_spacing_desktop | range | 0–40, step 1px | 20 | `--product-card-content-spacing` |
| product_card_content_gap_desktop | range | 0–32, step 1px | 14 | `--product-card-content-gap` |
| product_card_info_gap_desktop | range | 0–16, step 1px | 4 | `--product-card-info-gap` |
| product_card_content_spacing_mobile | range | 0–32, step 1px | 16 | `--product-card-content-spacing-mobile` |
| product_card_content_gap_mobile | range | 0–28, step 1px | 12 | `--product-card-content-gap-mobile` |
| product_card_info_gap_mobile | range | 0–16, step 1px | 4 | `--product-card-info-gap-mobile` |
| product_card_quick_add_enabled | checkbox | true/false | true | Render native add form khi product có available variant |
| product_card_quick_add_mobile | checkbox | true/false | true | Modifier mobile visibility |
| product_card_quick_add_color_scheme | color_scheme | scheme group | scheme-1 | Scheme riêng trên `__quick-add` |
| product_card_quick_add_style | select | icon, text | text | Icon dùng `theme-button` và icon cart |
| product_card_quick_add_full_width | checkbox | true/false | true | `__quick-add-button` width 100% khi bật |
| product_card_quick_view_enabled | checkbox | true/false | true | Native product link + `data-product-card-quick-view` |
| product_card_quick_view_mobile | checkbox | true/false | false | Modifier mobile visibility |
| product_card_secondary | checkbox | true/false | true | `--product-card-show-secondary-image`; mobile không hover |
| product_card_show_sale_badge | checkbox | true/false | true | Sale badge theo `--sale-price-color` |
| product_card_show_sold_out_badge | checkbox | true/false | true | Sold-out badge theo semantic badge token |
| product_card_vendor | checkbox | true/false | false | Chỉ render khi product.vendor có dữ liệu |
| product_card_type | checkbox | true/false | false | Chỉ render khi product.type có dữ liệu |
| product_card_swatches_enabled | checkbox | true/false | true | Liquid chỉ render khi bật và có option swatch phù hợp |
| product_card_swatch_position | select | top, bottom | top | Liquid đặt nhóm trước hoặc sau chi tiết sản phẩm |
| product_card_swatch_type | select | color, variant_image | color | Được truyền vào `snippets/swatch.liquid`; thiếu ảnh dùng màu hoặc bề mặt trung tính |
| product_card_swatch_limit | select | 2, 3, 4, 5, 6 | 4 | Liquid đổi lựa chọn chuỗi sang số để giới hạn option values; phần còn lại hiển thị thành `+N` |
| product_card_swatch_gap | range | 0–20, step 1px | 8 | `--product-card-swatch-gap` |
| product_card_swatch_width_desktop | range | 16–48, step 1px | 30 | `--product-card-swatch-width` |
| product_card_swatch_width_mobile | range | 16–48, step 1px | 30 | `--product-card-swatch-width-mobile` |
| product_card_swatch_ratio | select | 1:1, 3:2, 2:1, 3:1 | 3:1 | `--product-card-swatch-ratio` |
| product_card_swatch_selected_style | select | border, underline | border | Class `product-card__swatches--selected-*` điều khiển viền hoặc gạch chân |

Setting legacy `product_card_gap` không còn xuất hiện trong Editor nhưng vẫn có
fallback trong Liquid để store cũ không mất spacing khi chưa có dữ liệu của
contract mới. `product_card_radius` bị loại khỏi data vì product card kế thừa
`radius_media_containers`; component không tự tạo semantic color, button hover
hoặc radius token ngoài foundation.

### Accessibility và tiêu chí nghiệm thu

- Mỗi card là `article`, title là heading semantic có link; media placeholder,
  product title, quick add và quick view đều có accessible name.
- Quick add có form native, hidden variant id không bị CSS input contract áp
  style; button dùng `.btn` và giữ nguyên chiều rộng khi loading.
- Swatch là radio trong label, có tên option ẩn cho trình đọc màn hình và
  trạng thái checked/focus-visible theo rule của card. Radio lưu URL Shopify
  để component chuyển trang khi value thuộc sản phẩm khác hoặc thiếu variant.
- Khi số giá trị vượt giới hạn swatch, card hiện `+N` để cho biết còn lựa chọn khác.
- Card đổi Standard/Card, scheme, ratio, alignment, gap, quick actions và
  swatches độc lập trong Theme Editor; không đổi markup section.
- Card hoạt động khi thiếu ảnh, vendor, type, badge, price hoặc swatch; không
  render ảnh rỗng và không gây layout shift do ratio/ảnh có kích thước.
- Collection và product search dùng cùng kernel; quick add/view có fallback
  khi JavaScript hoặc dữ liệu tương tác không khả dụng; layout ổn định ở
  desktop, tablet và mobile.

## 11. Variant pickers

### Mục đích

Chuẩn hóa cách chọn từng product option trong product form, đồng bộ lựa chọn
với variant thật của sản phẩm và hỗ trợ lọc media theo variant đang chọn. Button
và Dropdown chỉ là hai presentation của cùng một nguồn dữ liệu.

### Consumer và file liên quan

- Markup: snippets/variant-picker.liquid.
- Consumer và media gallery: sections/product.liquid.
- Token mapping: snippets/css-variables.liquid.
- CSS foundation: assets/critical.css.
- Hành vi: assets/variant-picker.js với custom element `variant-picker`.

### Responsive, accessibility và fallback

Desktop/tablet dùng `--variant-height`, `--button-padding-inline-desktop` và
mobile dùng `--variant-height-mobile`, `--button-padding-inline-mobile` tại
breakpoint chung `767.98px`. Group, label và item spacing luôn lấy token; giá
trị dài được wrap để không làm vỡ layout.

Button dùng radio input thật với label liên kết bằng id; Dropdown dùng select
native và legend/`aria-labelledby`. Unavailable bị disabled khi không có
combination tương ứng; sold out vẫn có thể được chọn để trạng thái sản phẩm và
nút Add to cart phản ánh đúng, đồng thời hiển thị label có nghĩa thay vì chỉ
dùng màu. Focus-visible dùng token của Form.

Nếu JavaScript không khả dụng, control native và variant hiện tại vẫn được
render; khi có JavaScript, custom element giải variant id, cập nhật hidden
`name="id"`, trạng thái submit và media gallery qua `data-option-control`,
`data-variant-id`, `data-variant-data` và `data-product-media`.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| variant_picker_style | select | button, dropdown | dropdown | Ánh xạ `.variant-picker--button` hoặc `.variant-picker--dropdown`; giá trị legacy `buttons` được normalize về `button` |
| variant_picker_height_desktop | range | 36–64 px, step 1 | 44 px | `--variant-height`; không hard-code theo section |
| variant_picker_height_mobile | range | 36–64 px, step 1 | 44 px | `--variant-height-mobile`; không hard-code theo section |
| variant_picker_group_gap | range | 0–40 px, step 1 | 20 px | `--variant-group-gap` |
| variant_picker_label_spacing | range | 0–24 px, step 1 | 12 px | `--variant-label-spacing` |
| variant_picker_item_gap | range | 0–24 px, step 1 | 8 px | `--variant-item-gap` |
| variant_picker_only_selected_media | checkbox | true/false | false | `data-only-selected-media`; giữ media chung và media liên kết với variant |

`--variant-radius` lấy từ `radius_variant_pickers`; `--variant-border-width`
vẫn dùng `--input-border-width` của Form. Variant picker không tạo setting
radius riêng theo section.
Mỗi variant option dùng `--variant-height`, `--variant-height-mobile`,
`--variant-group-gap`, `--variant-label-spacing`, `--variant-item-gap`,
`--variant-radius` và `--variant-border-width`; không tạo token theo từng
section.

### Tiêu chí nghiệm thu

- Editor hiển thị đúng Button/Dropdown với Dropdown được chọn mặc định và các
  giá trị tham chiếu 44/44/20/12/8; toggle media mặc định tắt và có helper link
  Learn how to set up multiple variant images.
- Button và Dropdown dùng chung `product.options_with_values`, resolve đúng
  variant id và submit qua hidden `name="id"`.
- Item height, group gap, label spacing và item gap hoạt động đúng ở desktop,
  tablet và mobile.
- Selected, unavailable, sold out và focus-visible có tín hiệu trực quan lẫn
  ngữ nghĩa; không ẩn unavailable option khỏi người dùng.
- Khi bật media filter, media có `image.variants` chỉ hiện cho variant đang
  chọn; media chung vẫn hiện và gallery không rơi vào trạng thái rỗng.

## 12. Swatches

### Mục đích

Chuẩn hóa swatch màu hoặc ảnh cho variant picker và product card. Dữ liệu
`product_option_value.swatch` là nguồn ưu tiên. Color mode dùng màu từ swatch
hoặc palette fallback theo tên option; variant-image mode dùng ảnh variant, sau
đó ảnh swatch đã lưu, và cuối cùng là nền neutral.

### Consumer và file liên quan

- Markup: snippets/swatch.liquid, snippets/variant-picker.liquid và
  snippets/product-card-swatches.liquid.
- Token: snippets/css-variables.liquid.
- CSS: assets/critical.css.
- Product card chỉ remap `--product-card-swatch-*` vào `--swatch-*` trong scope card,
  không tạo bộ token visual thứ hai.

### Responsive, accessibility và fallback

`.swatches`, `.swatch`, `.swatch__input` và `.swatch__label` dùng cùng BEM
contract. Control cha giữ accessible name; visual swatch là decorative. Giá trị
thiếu màu/ảnh dùng neutral surface nhưng vẫn có label, focus-visible, selected,
unavailable và sold-out state. Width chuyển sang token mobile tại breakpoint
chung, ratio không đổi theo breakpoint.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| swatch_style | select | color, variant_image, button, dropdown | color | Kiểu hiển thị cho option màu ở picker sản phẩm; option còn lại theo Variant pickers |
| swatch_width_desktop | range | 16–64px, step 1 | 40 | `--swatch-width` |
| swatch_width_mobile | range | 16–64px, step 1 | 40 | `--swatch-width-mobile` |
| swatch_height_ratio | select | 1:1, 3:2, 2:1, 3:1 | 3:1 | Chỉ hiện và áp dụng cho Color; Variant image dùng 1:1 |
| swatch_selected_style | select | border, underline | underline | `--swatch-selected-style` và `.swatches--selected-*` |

Color và Variant image hiện Width desktop/mobile và Selected variant style.
Button và Dropdown ẩn các control này. Block Variant picker không có override
Swatches; Product cards và picker trong Bundle giữ cấu hình swatch riêng theo
Product cards.

`--swatch-radius` lấy từ `radius_swatches`. Không component nào được tạo token
màu/size/radius swatch ngoài contract này; product card chỉ được remap
`--product-card-swatch-*` vào token global trong scope của card. Helper nhắc rõ nhóm
Product cards là nơi cấu hình swatch riêng của card; Theme Settings schema
không có deep-link ổn định tới category hiện tại mà không nhúng theme ID.

### Tiêu chí nghiệm thu

- Color và variant image đều liên kết đúng option value/variant; thiếu ảnh
  fallback lần lượt về color rồi label/surface neutral.
- Width desktop/mobile, height ratio và selected style hoạt động ở variant
  picker; Product cards giữ override theo contract riêng mà không phá layout.
- Focus-visible, selected, unavailable và sold-out rõ ràng, dùng được bằng bàn
  phím, chuột và cảm ứng.

## 13. Badges

### Mục đích

Chuẩn hóa badge theo trạng thái sale và sold-out; data layer quyết định label
còn primitive chỉ trình bày BEM và token foundation.

### Consumer và file liên quan

- Resolver: `snippets/product-badges.liquid`.
- Primitive: `snippets/badge.liquid`.
- Consumer: `snippets/product-card.liquid`.
- CSS/token: `assets/critical.css` và `snippets/css-variables.liquid`.

### Responsive, accessibility và fallback

`.product-badge`, `.product-badge--sale` và `.product-badge--sold-out` giữ label
thật trong DOM, wrap theo container và giới hạn chiều rộng trên card để không
che nội dung ở mobile. Sold-out được ưu tiên trước sale; badge rỗng hoặc trạng
thái bị tắt không render.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| badge_sale_price_color | color | CSS color | #D82727 | `--badge-sale-price`, consumer `--price-sale-color` |
| badge_sale_background_color | color | CSS color | #D82727 | `--badge-sale-background` |
| badge_sale_text_color | color | CSS color | #FFFFFF | `--badge-sale-color` |
| badge_sold_out_background_color | color | CSS color | #ADADAD | `--badge-sold-out-background` |
| badge_sold_out_text_color | color | CSS color | #181818 | `--badge-sold-out-color` |
| badge_sale_type | select | text, percentage, percentage_only, amount_saved | text | Sale label formatter; percentage rounded to integer |

Shared foundation tokens are `--badge-font-family`, `--badge-font-size`,
`--badge-font-weight`, `--badge-letter-spacing` and `--badge-padding`. No
component hard-codes status colors; invalid/blank color values fall back to
the scheme tokens.

### Tiêu chí nghiệm thu

- Corner radius exposes exactly Square, Rounded and Pill; status colors map to
  sale price/background/text and sold-out background/text independently.
- Sale supports Text, Percentage, Percentage only and Amount saved, including
  localized amount/percentage output.
- Collection badges and custom product-card tags are not exposed or rendered.
- Badge text remains readable and focus/interaction context is not obscured on
  mobile or with long labels.

## 14. Prices

### Mục đích

Chuẩn hóa thứ tự giá sale/compare-at, currency code theo từng ngữ cảnh và
fallback cho variant/unit price trên product card, product page và cart.

### Consumer và file liên quan

- Markup/logic: `snippets/price.liquid`.
- Consumers: `snippets/product-card.liquid`, `sections/product.liquid`,
  `sections/cart.liquid` và các section dùng product card.
- Variant refresh: `assets/variant-picker.js` thay markup đã render sẵn, không
  tự format tiền bằng JavaScript.
- CSS/token: `assets/critical.css` và `snippets/css-variables.liquid`.

### Responsive, accessibility và fallback

`Show sale price first` quyết định thứ tự DOM của sale và compare-at; compare-at
dùng `<s>` và sale luôn có screen-reader label, nên màu không phải tín hiệu duy
nhất. `money`/`money_with_currency` và `unit_price_with_measurement` được gọi
trong cùng component. Product card và product page có currency-code toggle
riêng; cart dùng market money mặc định.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| price_show_sale_first | checkbox | true/false | true | Thứ tự sale trước hoặc compare-at trước; chỉ sale hợp lệ mới có compare-at |
| price_currency_code_product_cards | checkbox | true/false | false | Product card dùng `money_with_currency` khi bật |
| price_currency_code_product_pages | checkbox | true/false | false | Product page dùng `money_with_currency` khi bật |

### Tiêu chí nghiệm thu

- Giá sale/compare-at đổi đúng thứ tự theo `price_show_sale_first`.
- Currency code bật độc lập cho product cards và product pages; không hard-code
  ký hiệu, mã hoặc dấu phân cách.
- Variant price đổi qua cùng price markup khi chọn variant; unit price chỉ xuất
  hiện khi có measurement hợp lệ.
- Cart line item và cart total dùng cùng snippet; giá không bị tràn trên mobile.

## 15. Overlay & Layering

### Mục đích

Định nghĩa ngữ cảnh màu, scale typography, backdrop và primitive cho popover,
drawer, bottom sheet và popup. Component đọc token gần nhất, không tự đặt màu,
shadow, padding hoặc z-index rời rạc.

### Consumer và file liên quan

- Settings: `config/settings_schema.json`, `config/settings_data.json` và
  `locales/en.default.schema.json`.
- Token mapping: `snippets/css-variables.liquid`.
- Foundation selectors: `assets/critical.css` gồm `.theme-overlay`,
  `dialog::backdrop`, `[popover]`, `.drawer`, `[data-drawer]`,
  `.bottom-sheet`, `[data-bottom-sheet]` và các title hook.
- Drawer/popup implementation tương lai phải dùng `--z-base`, `--z-drawer` và
  `--z-modal`, không tạo z-index mới trong section.

### CSS Foundation

- `overlay_color_scheme` resolve một scheme độc lập; panel dùng
  `--overlay-background-color`, `--overlay-text-color`,
  `--overlay-border-color` và `--overlay-shadow-color`.
- `overlay_title_size` dùng cùng visual scale với Heading block
  (`display`, `xl`, `lg`, `md`, `sm`, `xs`, `custom`) và map về
  `--overlay-title-size`; cỡ `custom` lấy từ `overlay_custom_title_size`.
  Setting là nguồn size chung cho các title trong overlay và drawer, gồm cả
  Cart drawer; setting không thay đổi semantic HTML.
- `overlay_backdrop_blur` map về `--overlay-backdrop-blur`; `.theme-overlay` và
  `dialog::backdrop` dùng `backdrop-filter` với `background-color` dạng
  `rgba()` từ màu shadow của `overlay_color_scheme` và alpha của
  `overlay_opacity`.
- Popover dùng `--overlay-popover-border-width` và
  `--overlay-popover-shadow`. Drawer dùng
  `--overlay-drawer-padding-desktop` và `--overlay-drawer-padding-mobile` làm
  khoảng inset ngoài panel (top/right/bottom); content padding giữ riêng qua
  `--overlay-drawer-content-padding-desktop` và
  `--overlay-drawer-content-padding-mobile`.
- Radius kế thừa `--media-radius`, `--drawer-radius`, `--bottom-sheet-radius`
  và `--overlay-radius` từ Radius & Shape; không hard-code `border-radius`.

### Responsive, accessibility và fallback

Desktop/tablet dùng padding desktop; dưới breakpoint `767.98px` dùng padding
mobile. Giá trị blank hoặc scheme không hợp lệ fallback về scheme mặc định,
Heading `md`, cỡ custom 24px, blur 20px, border 0px, shadow Medium và padding mặc định.
Opacity là 0–80%; overlay không chứa thông tin nên không cần accessible name.
Dialog native vẫn cần focus management, `aria-modal`, tên accessible và
keyboard Escape ở component implementation. Focus-visible không bị cắt bởi
radius; reduced-motion policy áp dụng cho animation mở/đóng ở phase Motion.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| overlay_color_scheme | color_scheme | Scheme được định nghĩa trong Color schemes | scheme-1 | Chọn scheme cho panel/backdrop; invalid -> default scheme |
| overlay_title_size | select | display, xl, lg, md, sm, xs, custom | md | Cùng visual scale với Heading block; `--overlay-title-size`; không đổi semantic HTML |
| overlay_custom_title_size | range | 10–100, step 1px | 24 | Dùng khi `overlay_title_size=custom` |
| overlay_backdrop_blur | range | 0–40, step 1px | 20 | `--overlay-backdrop-blur`; chỉ dùng cho backdrop |
| overlay_popover_border_width | range | 0–3, step 1px | 0 | `--overlay-popover-border-width`; chỉ áp dụng cho popover |
| overlay_popover_shadow | select | none, small, medium, large | medium | `--overlay-popover-shadow`; màu lấy từ scheme shadow |
| overlay_drawer_padding_desktop | checkbox | true/false | true | `--overlay-drawer-padding-desktop`; inset ngoài top/right/bottom từ 768px |
| overlay_drawer_padding_mobile | checkbox | true/false | false | `--overlay-drawer-padding-mobile`; inset ngoài top/right/bottom dưới 767.98px |
| overlay_opacity | range | 0–80, step 5% | 40 | `--overlay-opacity` và alpha của `--overlay-backdrop-color`; chia 100 thành CSS alpha |
| overlay_z_base | range | 0–100, step 1 | 10 | --z-base |
| overlay_z_drawer | range | 100–900, step 10 | 200 | --z-drawer |
| overlay_z_modal | range | 1000–2000, step 10 | 1000 | --z-modal |

`overlay_color` legacy đã được loại khỏi contract và migrate sang
`overlay_color_scheme`; không render color picker riêng cho overlay.

### Tiêu chí nghiệm thu

- Theme Editor hiển thị Color scheme kèm Edit scheme, Title size Heading 4,
  Backdrop blur 20px, Popover border 0px, Shadow Medium, Drawer desktop bật và
  mobile tắt.
- Đổi scheme cập nhật background/text/border/shadow của overlay mà không sửa
  markup component; nested scheme không bị phá.
- Overlay blur, popover border/shadow và drawer padding hoạt động đúng ở
  desktop/mobile; overlay không che popup do z-index sai thứ tự.
- Dialog/overlay không khóa scroll ngoài lúc đang mở; focus ring, accessible
  name, `aria-modal` và keyboard Escape contract được giữ khi bổ sung
  drawer/popup.

## 16. Social Media

### Mục đích

Quản lý URL mạng xã hội và cách hiển thị link trong footer mà không hard-code
profile URL.

### Consumer và file liên quan

- Settings: config/settings_schema.json.
- Markup: snippets/social-links.liquid.
- Consumer: blocks/social-links.liquid, allowed by blocks/_column.liquid and used
  by the active Footer group/preset in sections/footer-group.json and
  sections/footer.liquid.
- CSS/accessibility: assets/critical.css.

### Responsive, accessibility và fallback

URL blank bị bỏ qua. Footer links wrap trên mobile. Khi chỉ hiện initial visual,
full label vẫn nằm trong visually-hidden text và aria-label. Link mở tab mới
thêm rel=noopener noreferrer.

### Setting Contract

| ID | Type | Values | Default | Mapping / constraint |
| --- | --- | --- | --- | --- |
| social_facebook | url | URL hoặc blank | blank | facebook link |
| social_instagram | url | URL hoặc blank | blank | instagram link |
| social_tiktok | url | URL hoặc blank | blank | tiktok link |
| social_youtube | url | URL hoặc blank | blank | youtube link |
| social_pinterest | url | URL hoặc blank | blank | pinterest link |
| social_x | url | URL hoặc blank | blank | X link |
| social_linkedin | url | URL hoặc blank | blank | linkedin link |
| social_show_labels | checkbox | true/false | false | Initial hoặc full label |
| social_new_tab | checkbox | true/false | true | target=_blank + rel |

### Tiêu chí nghiệm thu

- Chỉ URL đã cấu hình mới render.
- Mỗi link có accessible name.
- Social links không làm footer overflow ở mobile.

## Phase 2 acceptance checklist

- Theme Editor hiển thị đủ 16 nhóm theo dependency order.
- Mọi setting contract ở trên có ID/type/default/value mapping khớp
  config/settings_schema.json.
- snippets/css-variables.liquid normalize từng scheme token trước khi phát ra
  CSS, nên theme data cũ thiếu key vẫn có giá trị fallback.
- assets/critical.css có responsive breakpoints, focus-visible và reduced-motion.
- Existing header/footer/product/collection/search/cart render không có lỗi
  mới trong scope thay đổi; toàn bộ Theme Check output và blocker có sẵn được
  ghi trong QA report.
- git diff --check sạch; không có credential/secret trong diff.
