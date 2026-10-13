import { getSwiperCarousel } from './swiper-carousel.js';

// Keep nested editor selections visible in the shared mobile carousel.
// Swiper and its section load/unload lifecycle are owned by product-collection-carousel.
document.addEventListener('shopify:block:select', (event) => {
  const card = event.target.closest?.('.image-card');
  const carousel = card?.closest('.promo-grid__carousel');
  const swiper = carousel ? getSwiperCarousel(carousel) : null;
  if (!swiper || swiper.destroyed) return;
  const index = Array.from(swiper.slides).indexOf(card);
  if (index >= 0) swiper.slideTo(index, 0);
});
