# Quy trình tạo sản phẩm, collection và blog post

Đây là hướng dẫn dùng chung cho việc tạo, bổ sung và rà soát nội dung Shopify của các template trong dự án. Đọc file này trước khi thực hiện yêu cầu liên quan.

## Cách gọi

Ví dụ:

> Đọc `docs/content-creation-workflow.md`, rồi tạo sản phẩm, collection và blog post cho template Perky theo Figma hiện tại. Audit dữ liệu đã có trước, tạo phần còn thiếu và gắn vào Theme Editor.

Hoặc gọi riêng từng phần:

> Theo `docs/content-creation-workflow.md`, rà soát và bổ sung sản phẩm cho Perky.

> Theo `docs/content-creation-workflow.md`, tạo collection có ảnh và gắn vào editor.

> Theo `docs/content-creation-workflow.md`, tạo blog post cho section Featured blog posts.

Nếu người dùng chỉ yêu cầu **audit/kiểm tra/thống kê**, chỉ đọc dữ liệu và báo cáo; không tự tạo hoặc sửa tài nguyên. Nếu yêu cầu **tạo/cập nhật/gắn vào editor**, thực hiện phần được yêu cầu, kiểm tra kết quả rồi báo cáo. Không hỏi lại những hành động đã được cho phép.

## 1. Xác định phạm vi và nguồn dữ liệu

1. Xác định template, branch, store, theme ID và nguồn thiết kế từ yêu cầu hiện tại và project context. Không dùng store/theme ID của template nguồn để ghi dữ liệu cho template mới.
2. Đọc hướng dẫn dự án và các receipt/audit hiện có. Xác nhận store thực tế của công cụ kết nối trước khi dùng.
3. Kiểm tra tài nguyên Shopify đã có bằng title, handle, tag và nội dung. Một sản phẩm xuất hiện ở nhiều section chỉ tạo một lần; cho phép thuộc nhiều collection.
4. Lập danh sách cần tạo/cập nhật: tên, handle, nguồn ảnh, giá, option, collection membership, blog đích và vị trí gắn trong editor.
5. Dùng tên, giá, màu, kích thước, ảnh và nội dung trong thiết kế khi có. Không suy số sản phẩm từ pagination hoặc coi mọi ảnh trang trí là một sản phẩm riêng.
6. Với nội dung demo chưa có trong thiết kế, ghi rõ dữ liệu được đề xuất. Không bịa thông số, chứng nhận, chất liệu, độ tuổi sử dụng an toàn hoặc công dụng chưa có nguồn. Hỏi phần thông tin bắt buộc còn thiếu và tiếp tục các phần độc lập.

Hướng dẫn mới, cụ thể của người dùng được ưu tiên hơn file này. Các receipt cũ ghi tồn kho 100 hoặc số ảnh khác là lịch sử thực hiện, không thay thế quy tắc dưới đây.

## 2. Sản phẩm

### Quy tắc đã được người dùng chốt

| Thành phần | Yêu cầu |
| --- | --- |
| Ảnh | Tối thiểu 4 ảnh cho từng sản phẩm. Nếu design chỉ có 1 ảnh: ảnh 1 là ảnh sản phẩm, ảnh 2 là product life, ảnh 3 và 4 là các góc nhìn khác của cùng sản phẩm. Dùng ảnh gốc làm tham chiếu để render phần thiếu. |
| Description | Có mô tả đầy đủ, phù hợp đúng sản phẩm. |
| Giá | Có giá gốc và giá khuyến mãi. |
| Tồn kho | Số lượng trung bình 20; không lấy mặc định 100 từ receipt cũ. |
| Summary | Có metafield summary. |
| Tag | Có `New` hoặc `Bestseller`. |
| Variant | Bắt buộc có `Color`, dùng dữ liệu màu liên kết metafield. Chuẩn hóa option về `Color` và `Size` khi có kích thước thực tế. |

### Tên và phân loại

- Title giữ tên sản phẩm trong thiết kế, không thêm tên template phía sau theo quy trình template hiện có.
- Sản phẩm mới dùng handle `<template-slug>-<product-slug>`, ví dụ `perky-rocking-horse`. Không đổi handle tài nguyên đã có nếu không cần thiết.
- Chọn product category đúng loại sản phẩm; mô tả và collection membership phải phù hợp với category.
- Gắn ít nhất một tag `New` hoặc `Bestseller` theo vị trí thiết kế. Nếu thiết kế không chỉ định, dùng `New` cho sản phẩm demo mới; không tự tuyên bố sản phẩm thực tế bán chạy.

### Giá và tồn kho

- Shopify `price` là giá bán/khuyến mãi; `compareAtPrice` là giá gốc và phải lớn hơn giá bán khi cần hiển thị giảm giá.
- Chép đúng giá và tiền tệ từ thiết kế. Nếu thiết kế chỉ có một giá, không tự bịa giá còn thiếu hoặc tỷ lệ giảm; ghi thiếu và lấy thông tin từ người dùng.
- Với dữ liệu demo mới không có yêu cầu khác, áp dụng **20 đơn vị cho mỗi variant có hàng** tại location đã xác nhận. Đây là cách áp dụng mặc định của quy trình cho yêu cầu “số lượng trung bình 20”.
- Giữ đúng trạng thái sold out hoặc tồn kho cụ thể trong thiết kế/yêu cầu. Không tự ghi đè tồn kho đang vận hành của sản phẩm có sẵn khi chỉ bổ sung nội dung.

### Description và summary

- Description gồm giới thiệu, đặc điểm có căn cứ và thông tin sử dụng/chăm sóc khi có nguồn. Không chỉ lặp title hoặc để placeholder.
- Summary là đoạn tóm tắt ngắn, phù hợp description và dùng đúng metafield mà theme đang đọc.
- Kiểm tra definition, namespace/key và kiểu dữ liệu summary hiện có trước khi ghi. Không tự tạo thêm một field tương tự chỉ vì chưa tìm đúng field.

### Color, Size và swatch

- Tạo `Color` theo màu sản phẩm thực tế; sản phẩm một màu vẫn có giá trị Color phù hợp.
- Liên kết màu bằng category metafield/metaobject mà Shopify và theme sử dụng, theo contract hiện có (ví dụ `shopify.color-pattern`); không chỉ nhập tên option dạng text rồi coi đã hoàn thành.
- Khi chuẩn hóa sản phẩm có option `Birthstone` hoặc `Material`, đối chiếu giá trị với màu thực tế để đổi thành `Color`. Không đổi tên hàng loạt nếu làm mất thông tin hoặc tạo tổ hợp trùng; giữ thông tin chất liệu/đá có căn cứ trong mô tả hoặc field phù hợp.
- Chỉ thêm `Size` khi có kích thước hợp lý và có nguồn. Không bịa size cho đồ chơi, phụ kiện hoặc sản phẩm không có lựa chọn kích thước.
- Kiểm tra mọi tổ hợp variant, giá, tồn kho và hình swatch sau khi tạo hoặc đổi option.

### Ảnh sản phẩm và ảnh variant

- Khi dùng trình tạo ảnh để tạo hoặc bổ sung ảnh sản phẩm (catalog, ảnh variant và product life), dùng **model `gpt-6-luna` với reasoning effort `max`** cho agent thực hiện tác vụ. Đây là cấu hình model của agent gọi công cụ tạo ảnh; không phải tham số model của công cụ tạo ảnh. Nếu môi trường không hỗ trợ cấu hình này, báo rõ giới hạn, không tự tuyên bố đã dùng đúng model.
- Lấy ảnh đúng sản phẩm từ thiết kế/nguồn được cung cấp; upload vào Shopify Files/product media, không đưa ảnh nội dung vào theme `assets`.
- Mỗi sản phẩm phải có **tối thiểu 4 ảnh**. Sản phẩm dưới 4 ảnh phải được liệt kê rõ là chưa đạt, không dùng trung bình toàn bộ nhóm hoặc sản phẩm nhiều ảnh để che phần còn thiếu.
- Nếu sản phẩm trong design chỉ có một ảnh, giữ ảnh đó làm **ảnh 1 — ảnh sản phẩm/catalog**; tạo **ảnh 2 — product life** có đối tượng đang sử dụng đúng sản phẩm theo quy tắc bên dưới; tạo **ảnh 3 và 4 — hai góc nhìn khác của chính sản phẩm**, chẳng hạn mặt sau, bên trái, bên phải hoặc góc nghiêng tùy cấu tạo và góc ảnh gốc. Chọn góc bổ sung có ích để người xem hiểu sản phẩm, không lặp ảnh hoặc chỉ đổi nền để tính đủ 4 ảnh.
- Ảnh góc bổ sung phải nhất quán với ảnh gốc về hình dáng, màu, tỷ lệ và chi tiết nhận diện. Đối chiếu nguồn bổ sung khi có; không tự bịa chi tiết ở mặt khuất. Nếu không đủ căn cứ để dựng một góc, chọn góc khác có thể xác minh hoặc ghi rõ cần thêm ảnh tham chiếu.
- Với mỗi màu thực tế, có ảnh catalog và ảnh lifestyle/ảnh phụ phù hợp màu đó theo quy trình đã dùng cho Strideo. Nhiều màu có thể cần hơn 4 ảnh.
- Ảnh render phải giữ đúng hình dáng và nhận diện sản phẩm, màu variant và tỷ lệ khung ảnh của thiết kế. Không dùng một ảnh màu khác để giả lập đã đủ ảnh cho mọi màu.
- Gắn ảnh catalog làm ảnh chính của variant. Gắn ảnh phụ đúng màu vào variant metafield `custom.secondary_image` theo contract hiện có; kiểm tra definition và kiểu `file_reference` trước khi ghi.
- Với sản phẩm chỉ có một ảnh design, sắp xếp gallery theo thứ tự catalog → product life → góc bổ sung 1 → góc bổ sung 2. Với nhiều màu, tổ chức theo từng màu, bắt đầu bằng cặp catalog/product life rồi đến các góc bổ sung của màu đó; gắn đúng media/metafield cho variant. Thêm alt mô tả đúng sản phẩm, màu và góc nhìn hoặc hành động sử dụng.
- Chờ media ở trạng thái sẵn sàng, rồi kiểm tra URL thực tế và ảnh khi đổi variant.

### Ảnh product life: sản phẩm được sử dụng trong thực tế

**Ảnh product life (lifestyle) phải có đối tượng sử dụng và thể hiện cách sử dụng đúng của chính sản phẩm.** Chỉ đặt sản phẩm trên bàn, trong phòng hoặc trong một không gian đẹp là ảnh bối cảnh/ảnh phụ; không tính là đã có ảnh product life. Người xuất hiện cạnh sản phẩm nhưng không có tương tác sử dụng phù hợp cũng chưa đáp ứng yêu cầu.

#### Hiểu sản phẩm trước khi tạo ảnh

1. Đối chiếu ảnh gốc, category, description, variant và hướng dẫn sử dụng có nguồn để xác định: sản phẩm là gì, dành cho ai, dùng ở đâu trên cơ thể hoặc trong hoạt động nào, và thao tác sử dụng thực tế là gì.
2. Xác định đặc điểm phải giữ nguyên: hình dáng, màu, chất liệu có căn cứ, chi tiết nhận diện, kích thước/tỷ lệ và cấu tạo. Dùng ảnh đúng sản phẩm và đúng màu làm tham chiếu; không chỉ dựa vào tên để tạo một sản phẩm tương tự.
3. Chọn một tình huống sử dụng cụ thể, thiết thực và phù hợp với sản phẩm. Không suy cách dùng chỉ từ ngành hàng: serum dạng nhỏ giọt và dạng vòi bơm cần thao tác khác nhau; các loại đồ chơi cũng cần hoạt động khác nhau.
4. Nếu chưa xác định được cách dùng, kích thước hoặc đối tượng sử dụng phù hợp từ nguồn hiện có, ghi rõ phần thiếu và lấy thông tin trước khi tạo cảnh phụ thuộc vào dữ liệu đó. Không tự bịa công dụng, độ tuổi an toàn hoặc thao tác sử dụng.

#### Ví dụ theo loại sản phẩm

| Loại sản phẩm | Cảnh product life đạt yêu cầu |
| --- | --- |
| Jewelry/trang sức | Người dùng đeo đúng vị trí: nhẫn trên ngón tay, vòng trên cổ tay, dây chuyền trên cổ, hoa tai trên tai. Thấy rõ sản phẩm và tỷ lệ so với cơ thể. |
| Giày | Người dùng mang giày trên chân, đứng hoặc bước đi tự nhiên; kiểu giày, màu và cấu tạo khớp ảnh gốc. Chỉ cầm giày hoặc đặt giày trong phòng chưa thể hiện việc sử dụng. |
| Đồ chơi | Em bé/trẻ nhỏ thuộc nhóm tuổi phù hợp theo nguồn đang thực sự chơi với món đồ đó, chẳng hạn cầm lắc xúc xắc hoặc thao tác với đồ chơi xếp khối. Cảnh, tư thế và mức giám sát phù hợp với hướng dẫn sử dụng; không chỉ đặt đồ chơi cạnh trẻ. |
| Serum | Người dùng cầm đúng chai serum và thực hiện thao tác thoa lên mặt phù hợp với hướng dẫn và loại bao bì, chẳng hạn lấy serum rồi thoa nhẹ bằng tay. Không để đầu nhỏ giọt xuyên vào da, tạo thao tác vô lý hoặc minh họa kết quả điều trị chưa có căn cứ. |

Áp dụng cùng nguyên tắc cho các ngành hàng khác: xác định đối tượng và hành động sử dụng đúng trước, rồi mới chọn bối cảnh, ánh sáng và bố cục.

#### Yêu cầu khi viết prompt và kiểm tra ảnh

- Prompt phải nêu rõ **sản phẩm tham chiếu + variant + đối tượng sử dụng + vị trí tiếp xúc/cách sử dụng + hành động cụ thể + tỷ lệ thực tế + bố cục thấy rõ sản phẩm**. Bối cảnh hỗ trợ hành động sử dụng, không thay thế hành động đó.
- Mẫu prompt: “Dùng ảnh tham chiếu của [sản phẩm, màu]. Giữ nguyên [đặc điểm nhận diện]. Thể hiện [đối tượng phù hợp] đang [hành động sử dụng đúng] tại [vị trí sử dụng], với tỷ lệ sản phẩm so với người đúng theo [nguồn kích thước nếu có]. Bố cục [tỷ lệ khung], thấy rõ sản phẩm và điểm tiếp xúc, tư thế tự nhiên, ánh sáng chân thực.” Bổ sung ràng buộc cụ thể theo sản phẩm, không dùng một prompt chung cho mọi ngành hàng.
- Kiểm tra ảnh sau render bằng mắt với ảnh gốc: đúng sản phẩm/màu, không biến dạng hoặc đổi thiết kế; sản phẩm không bị che đến mức khó nhận diện; kích thước so với người hợp lý.
- Kiểm tra tương tác vật lý: bàn tay/ngón tay, chân, khuôn mặt và tư thế tự nhiên; điểm cầm, đeo hoặc tiếp xúc đúng; không xuyên vật thể, nổi lơ lửng, sai vị trí đeo hoặc có bộ phận thừa. Hành động phải khả thi với cấu tạo thực tế của sản phẩm.
- Kiểm tra mức thiết thực: người xem nhận ra sản phẩm đang được dùng như thế nào và trong tình huống nào. Không dùng cảnh tạo dáng vô lý, đạo cụ lấn át hoặc người chỉ làm nền để gọi là product life.
- Ảnh chưa đạt phải sửa/render lại trước khi upload hoặc gắn làm ảnh lifestyle/`custom.secondary_image`. Khi nguồn chỉ có ảnh bối cảnh, ghi rõ còn thiếu product life; không đổi nhãn để coi đã hoàn thành.
- Alt mô tả đúng sản phẩm, màu và hành động sử dụng nhìn thấy trong ảnh. Lưu nguồn tham chiếu, tình huống sử dụng và kết quả kiểm tra vào receipt/audit.

## 3. Collection

### Tên, nội dung và ảnh

- Title có tên template ở cuối: `<Tên collection> <Template>`, ví dụ `Rattles Perky`, `New Arrivals Perky`.
- Collection mới dùng handle `<collection-slug>-<template-slug>`, ví dụ `rattles-perky`.
- Mỗi collection có ảnh đại diện. Ưu tiên ảnh đúng thiết kế; khi render, tham khảo sản phẩm thuộc collection để ảnh phù hợp nội dung.
- Ảnh collection ưu tiên dạng lifestyle, sản phẩm cần thấy rõ ở vùng giữa để crop không mất chủ thể. Theo tỷ lệ thiết kế; khi chưa có tỷ lệ cụ thể, dùng 1:1 hoặc 4:5 theo yêu cầu trước đây.
- Khi tạo ảnh collection dạng product life, áp dụng quy tắc đối tượng và hành động sử dụng thực tế ở mục 2; tham chiếu đúng sản phẩm thuộc collection.
- Upload ảnh vào Shopify và gắn trực tiếp vào trường ảnh collection. Không tạo bản dự phòng trùng lặp nếu không được yêu cầu.
- Viết description phù hợp nhóm sản phẩm, không thêm thông tin kỹ thuật hoặc tuyên bố chưa có nguồn.

### Membership và editor

- Dùng manual collection cho nhóm được chọn thủ công trong thiết kế. Chỉ dùng smart collection khi có quy tắc rõ ràng; kiểm tra membership thực tế sau khi áp dụng.
- Chọn sản phẩm đúng category/chủ đề; không thêm sản phẩm không liên quan để đủ số lượng.
- Nếu yêu cầu có số lượng tối thiểu, đáp ứng số lượng đó. Yêu cầu cũ “ít nhất 5 sản phẩm mỗi danh mục” xuất phát từ shop trang sức; không tự áp dụng cho mọi template mới. Nếu thiếu sản phẩm phù hợp, báo thiếu và đề xuất nguồn/nội dung demo.
- Gắn collection vào đúng resource picker, tab, thumbnail, banner, hotspot hoặc nút liên quan theo phạm vi yêu cầu. Dùng link collection thật và ảnh collection thật.
- Nếu người dùng yêu cầu tạo collection trước, có thể để sản phẩm trống, nhưng phải báo rõ. Không báo catalog đã hoàn thành khi membership chưa được bổ sung.
- Kiểm tra trạng thái khả dụng trên Online Store theo yêu cầu và môi trường demo hiện tại.

## 4. Blog post

### Blog riêng cho từng template

- Mỗi template có một blog riêng để chứa các bài viết mới của template đó. Blog mang tên template và dùng handle `<template-slug>`; ví dụ làm template Perky thì dùng blog **Perky**, handle `perky`, rồi tạo mọi bài viết mới của Perky trong blog này.
- Kiểm tra blog theo tên, handle và ID trước khi tạo. Nếu đã có blog đúng template thì dùng lại; nếu chưa có thì tạo blog trước, lấy ID trả về rồi dùng ID đó khi tạo bài viết. Không tạo blog riêng cho từng bài hoặc tạo trùng blog mỗi lần chạy.
- Không gắn bài mới vào `News` hoặc blog của template khác chỉ vì section hiện đang chọn blog đó. Nếu người dùng chỉ định rõ một blog đích khác, ưu tiên chỉ định đó.
- Khi được yêu cầu gắn nội dung vào Theme Editor, chọn blog riêng của template trong picker của section và gắn article thuộc blog đó. Kiểm tra trang blog, link bài viết và nút View all đều dẫn đúng blog.
- Đọc lại quan hệ article → blog sau khi tạo; lưu blog ID/title/handle cùng article ID/handle vào manifest và receipt/audit. Không tự chuyển bài viết có sẵn ngoài phạm vi yêu cầu.

### Nội dung và hiển thị bài viết

- Kiểm tra bài viết đã có trong blog đích trước khi tạo để tránh trùng lặp.
- Mỗi bài có title, handle, nội dung đầy đủ, excerpt, ảnh đại diện và alt. Nội dung đúng chủ đề template, dùng cùng ngôn ngữ với thiết kế.
- Title giữ nội dung tiêu đề trong thiết kế; không tự thêm hậu tố template. Với bài mới cần phân biệt trong shop dùng chung, dùng handle `<template-slug>-<article-slug>`.
- Nội dung có phần mở đầu, các đoạn/đề mục dễ đọc và kết thúc phù hợp; excerpt là tóm tắt ngắn cho blog card, không để HTML lỗi hoặc placeholder.
- Dùng ảnh đúng thiết kế. Nếu cần ảnh demo, tạo ảnh phù hợp chủ đề, đúng tỷ lệ khung card; upload vào Shopify và gắn vào article, không đưa vào theme `assets`.
- Tác giả và ngày đăng lấy từ nguồn/yêu cầu; không giả danh tác giả hoặc tổ chức. Nếu thiếu tác giả, dùng tác giả mặc định đã xác nhận của blog/store; nếu chưa xác nhận thì ghi thiếu.
- Gắn tag phù hợp nếu có yêu cầu. Bổ sung SEO title/meta description phù hợp nội dung, không nhồi từ khóa.
- Đặt trạng thái đăng bài theo yêu cầu. Bài cần xuất hiện ngay trên homepage demo phải khả dụng ở thời điểm kiểm tra; không dùng ngày đăng tương lai khiến card trống.
- Gắn blog/article vào đúng picker mà section hỗ trợ. Nếu section lấy bài theo thứ tự blog, kiểm tra thứ tự/ngày đăng để bài featured và bài phụ hiển thị đúng; không sửa dữ liệu bài cũ ngoài phạm vi để ép thứ tự.
- Kiểm tra ảnh, title, excerpt, tác giả/ngày nếu bật, link card, trang bài viết và nút View all với dữ liệu thật.

## 5. Thực hiện và xác minh

1. Audit và chốt manifest từ dữ liệu đã xác định; phân biệt tài nguyên có sẵn, cần tạo, cần bổ sung và dữ liệu còn thiếu.
2. Chuẩn bị ảnh và nội dung, upload media, chờ xử lý xong.
3. Tạo/cập nhật đúng tài nguyên; xử lý lỗi API trước khi tiếp tục gắn tài nguyên phụ thuộc. Lưu ID/handle trả về để lần chạy lại không tạo trùng.
4. Gắn variant media, metafield, collection membership và blog/article relationships.
5. Gắn vào Theme Editor khi được yêu cầu; kiểm tra cấu hình đã lưu sau reload.
6. Đọc lại dữ liệu từ Shopify. Không coi request thành công là đã đủ thông tin đúng.
7. Kiểm tra preview desktop/mobile: ảnh thật, đổi Color/Size, giá, badge, tồn kho, ảnh hover, link collection/article và nội dung của các section liên quan.
8. Nếu có sửa code/schema/template, tuân thủ skill tương ứng và chạy kiểm tra phù hợp; với thao tác chỉ nhập nội dung, ưu tiên kiểm tra dữ liệu và preview thực tế.
9. Lưu receipt/audit trong `docs/<template-slug>/` với nguồn, ID, handle, dữ liệu đã ghi, vị trí gắn và kết quả xác minh. Không ghi token hay thông tin đăng nhập.

Tạo hoặc bật nội dung trên Online Store không đồng nghĩa với publish theme. Không publish theme, commit/push code hoặc sửa tài nguyên không liên quan nếu yêu cầu hiện tại không bao gồm các hành động đó.

## 6. Báo cáo hoàn thành

Báo ngắn gọn số lượng đã tạo/cập nhật và các phần còn thiếu. Chỉ đánh dấu đạt khi đã xác minh:

- **Product:** description, giá bán/giá gốc, tồn kho, summary, tag, Color/metafield, Size nếu có, số ảnh và ảnh theo màu; ảnh product life có đối tượng sử dụng, hành động đúng và tương tác/tỷ lệ chân thực.
- **Collection:** hậu tố template, ảnh, membership đúng, khả dụng và resource/link trong editor.
- **Blog post:** blog riêng đúng template, quan hệ article → blog, title, body, excerpt, ảnh, metadata, trạng thái/ngày đăng và link thật; picker và nút View all dẫn đúng blog khi có yêu cầu gắn vào editor.
- **Preview:** dữ liệu hiển thị sau reload; desktop/mobile và tương tác liên quan đã kiểm tra.

Liệt kê rõ mục chưa có dữ liệu, chưa tạo, chưa gắn hoặc chưa kiểm tra. Không báo “hoàn thành” dựa trên placeholder hoặc receipt của template khác.

## Nguồn quy tắc

- Chat cập nhật **content-creation-workflow.md**, 07/10/2026: tối thiểu 4 ảnh cho từng sản phẩm, thay mốc trung bình 4 ảnh trước đây; khi design chỉ có 1 ảnh, thứ tự là ảnh sản phẩm → product life → hai góc nhìn khác phù hợp của cùng sản phẩm.
- Chat cập nhật **content-creation-workflow.md**, 07/10/2026: mỗi template có blog riêng mang tên template; ví dụ blog Perky chứa mọi bài viết mới của template Perky.
- Chat cập nhật **content-creation-workflow.md**, 07/10/2026: tác vụ dùng trình tạo ảnh sản phẩm dùng model `gpt-6-luna`, reasoning effort `max`.
- Chat cập nhật **content-creation-workflow.md**, 07/10/2026: ảnh product life phải thể hiện đối tượng đang sử dụng đúng sản phẩm (đeo trang sức, mang giày, trẻ chơi đồ chơi, người dùng thoa serum); hiểu sản phẩm và kiểm tra tính chân thực, thiết thực, không chỉ đặt sản phẩm vào một không gian.
- Chat **Tạo sản phẩm - collection**, 24–25/07/2026: trung bình 4 ảnh, description, giá gốc/khuyến mãi, tồn kho trung bình 20, metafield summary, tag New/Bestseller, Color liên kết metafield; chuẩn hóa Birthstone/Material thành Color và dùng Size phù hợp.
- Chat **Perky template**, 07/10/2026: collection thêm tên template phía sau, có ảnh và gắn vào editor.
- `docs/strideo/product-import-qa.md`: cặp ảnh catalog/lifestyle theo màu, gallery và variant `custom.secondary_image`.
- `docs/perky/catalog-audit.json`: quy ước title/handle và chống tạo trùng; mục tồn kho 100 là lịch sử cũ, được thay bằng quy tắc 20 trong file này.
