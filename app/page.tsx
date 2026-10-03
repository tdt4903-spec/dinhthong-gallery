import styles from "./public-home.module.css";

const albums = [
  {
    name: "Minh & Trâm",
    info: "Đà Lạt · 12.09.2026",
    image:
      "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=88",
  },
  {
    name: "Hoàng & Ngọc",
    info: "Hà Tĩnh · 05.09.2026",
    image:
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=88",
  },
  {
    name: "Quang & Linh",
    info: "Ninh Bình · 28.08.2026",
    image:
      "https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1200&q=88",
  },
  {
    name: "Duy & Hương",
    info: "Quảng Bình · 20.08.2026",
    image:
      "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1200&q=88",
  },
];

const stories = [
  {
    title: "Tình yêu",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=88",
    className: styles.storyLarge,
  },
  {
    title: "Những chuyến đi",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=88",
    className: styles.storyWide,
  },
  {
    title: "Chi tiết",
    image:
      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=88",
    className: "",
  },
  {
    title: "Câu chuyện của bạn",
    image:
      "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=900&q=88",
    className: "",
  },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="#home" className={styles.brand}>
            Dinh Thong
            <small>GALLERY</small>
          </a>

          <nav className={styles.nav}>
            <a href="#home" className={styles.active}>
              Trang chủ
            </a>
            <a href="#album">Album</a>
            <a href="#stories">Khoảnh khắc</a>
            <a href="#about">Về chúng tôi</a>
            <a href="#contact">Liên hệ</a>
          </nav>

          <div className={styles.actions}>
            <div className={styles.iconButton}>⌕</div>
            <div className={styles.iconButton}>☼</div>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero} id="home">
          <div className={styles.heroInner}>
            <div className={styles.eyebrow}>
              Dinh Thong Gallery
            </div>

            <h1 className={styles.heroTitle}>
              Lưu giữ
              <br />
              những khoảnh khắc đẹp
            </h1>

            <p className={styles.heroText}>
              Nơi những câu chuyện được kể lại bằng hình ảnh —
              chân thật, cảm xúc và mang dấu ấn của riêng bạn.
            </p>

            <a href="#album" className={styles.heroButton}>
              <span>Khám phá album</span>
              <span className={styles.circleArrow}>→</span>
            </a>
          </div>

          <div className={styles.slider}>
            <b>01</b>
            <div className={styles.sliderLine}>
              <span />
            </div>
            <span>04</span>
          </div>
        </section>

        <section className={styles.albums} id="album">
          <div className={styles.sectionHeading}>
            <div className={styles.sectionEyebrow}>Album</div>

            <h2 className={styles.sectionTitle}>
              Album mới nhất
            </h2>

            <p className={styles.sectionText}>
              Những bộ ảnh mới nhất được thực hiện bởi
              Dinh Thong gallery.
            </p>

            <a href="/albumpublic" className={styles.viewAll}>
              Xem tất cả album
              <span>→</span>
            </a>
          </div>

          <div className={styles.albumGrid}>
            {albums.map((album) => (
              <a
                href="/albumpublic"
                className={styles.albumCard}
                key={album.name}
              >
                <div className={styles.albumImage}>
                  <img
                    src={album.image}
                    alt={album.name}
                  />
                </div>

                <div className={styles.albumMeta}>
                  <div>
                    <div className={styles.albumName}>
                      {album.name}
                    </div>

                    <div className={styles.albumInfo}>
                      {album.info}
                    </div>
                  </div>

                  <div className={styles.albumArrow}>
                    →
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.stories} id="stories">
          <div className={styles.storiesInner}>
            <div className={styles.storiesHeader}>
              <div>
                <div className={styles.eyebrow}>
                  Stories
                </div>

                <h2>Selected Stories</h2>
              </div>

              <p>
                Những câu chuyện, hành trình và chi tiết nhỏ
                tạo nên cảm xúc phía sau mỗi khung hình.
              </p>
            </div>

            <div className={styles.storyGrid}>
              {stories.map((story) => (
                <a
                  href="/albumpublic"
                  key={story.title}
                  className={`${styles.story} ${story.className}`}
                >
                  <img
                    src={story.image}
                    alt={story.title}
                  />

                  <div className={styles.storyText}>
                    <small>Stories</small>
                    <h3>{story.title}</h3>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.about} id="about">
          <div className={styles.aboutInner}>
            <div className={styles.sectionEyebrow}>
              Dinh Thong Gallery
            </div>

            <h2 className={styles.aboutTitle}>
              Ảnh đẹp không chỉ để xem.
              <br />
              Nó để nhớ.
            </h2>

            <p className={styles.aboutText}>
              Dinh Thong gallery lưu giữ những khoảnh khắc
              bằng cách kể lại câu chuyện của từng người qua
              hình ảnh tự nhiên, tinh tế và giàu cảm xúc.
            </p>
          </div>
        </section>
      </main>

      <footer className={styles.footer} id="contact">
        <div className={styles.footerInner}>
          <div>© 2026 Dinh Thong Gallery</div>
          <div>
            Photography · Storytelling · Wedding
          </div>
        </div>
      </footer>
    </div>
  );
}
