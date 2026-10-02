import { LEGAL_FACTS, PRIVACY_PATH, TERMS_PATH } from "../constants";
import {
  ContactEmail,
  LegalCallout,
  LegalH3,
  LegalLink,
  LegalList,
  LegalP,
  LegalValue,
} from "../components/legal-blocks";
import type { LegalDocument } from "../types";

// Naikkan VERSION dan ganti LAST_UPDATED setiap kali isi ketentuan berubah
// secara berarti. Riwayatnya cukup lewat git.
export const VERSION = "1.0";
export const LAST_UPDATED = "2026-10-02";
export const EFFECTIVE_DATE = "2026-10-02";

const operator = <LegalValue value={LEGAL_FACTS.operatorName} />;

export const TERMS: LegalDocument = {
  title: "Syarat & Ketentuan",
  description:
    "Aturan memakai Nihongofy: akun, diskusi publik, lisensi konten, batasan tanggung jawab, dan hukum yang berlaku.",
  path: TERMS_PATH,
  kicker: "Ketentuan",
  version: VERSION,
  lastUpdated: LAST_UPDATED,
  effectiveDate: EFFECTIVE_DATE,
  summary: (
    <p>
      Ketentuan ini mengatur penggunaan Nihongofy (jlpt.lans.my.id). Dengan mendaftar atau memakai
      layanan, Anda menyetujui ketentuan ini dan{" "}
      <LegalLink href={PRIVACY_PATH}>Kebijakan Privasi</LegalLink>. Bila tidak setuju, mohon tidak
      memakai layanan.
    </p>
  ),
  sections: [
    {
      id: "layanan",
      title: "Layanan",
      content: (
        <>
          <LegalP>
            Nihongofy dikelola oleh {operator} (&quot;kami&quot;) sebagai platform belajar bahasa
            Jepang dan simulasi JLPT. Layanan mencakup antara lain kana, flashcard kosakata, katalog
            pola bunpou, latihan cepat, mock test, artikel, catatan dan diskusi, serta percakapan
            dengan AI bila fitur itu tersedia.
          </LegalP>
          <LegalP>
            Sebagian fitur dapat dipakai tanpa akun, tetapi hasilnya tidak disimpan. Saat ini tidak
            ada fitur berbayar. Kami dapat mengubah, menonaktifkan sementara, atau menghentikan fitur
            tertentu kapan saja, misalnya untuk perbaikan atau saat terjadi penyalahgunaan.
          </LegalP>
        </>
      ),
    },
    {
      id: "akun",
      title: "Akun",
      content: (
        <>
          <LegalList
            items={[
              <>
                Anda harus berusia minimal <LegalValue value={LEGAL_FACTS.minimumAge} />. Bila
                belum berusia 18 tahun, Anda wajib mendapat persetujuan orang tua atau wali untuk
                mendaftar dan memakai layanan.
              </>,
              <>
                <strong>Satu orang, satu akun.</strong> Jangan membuat akun tambahan untuk
                menghindari batas penggunaan, pembatasan posting, atau sanksi lain.
              </>,
              <>
                Gunakan data yang benar. Email akun tidak dapat diubah dari aplikasi, jadi gunakan
                alamat yang Anda kuasai.
              </>,
              <>
                Jaga kerahasiaan password dan jangan memakainya bersama orang lain. Anda bertanggung
                jawab atas aktivitas yang terjadi di akun Anda. Bila curiga akun dipakai orang lain,
                ganti password dan cabut perangkat lain di{" "}
                <LegalLink href="/profile/security">Profil &gt; Keamanan</LegalLink>.
              </>,
              <>
                Bila masuk dengan Google, penggunaan akun Google Anda juga tunduk pada ketentuan
                Google. Menghubungkan Google ke akun yang sudah ada hanya dapat dilakukan dengan
                email yang sama persis.
              </>,
              <>
                Username tampil di diskusi publik. Jangan memakai username atau nama tampilan yang
                meniru orang lain, menyesatkan, atau melanggar aturan diskusi di bawah.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "penggunaan",
      title: "Penggunaan yang tidak diperbolehkan",
      content: (
        <LegalList
          items={[
            <>mengakses akun, data, atau area admin yang bukan milik Anda;</>,
            <>
              mengakali pembatas percobaan, verifikasi bot (Cloudflare Turnstile), atau langkah
              keamanan lain;
            </>,
            <>
              mengambil konten secara otomatis dan massal (scraping), atau membebani layanan secara
              tidak wajar;
            </>,
            <>
              memakai layanan untuk tindakan yang melanggar hukum atau hak orang lain, termasuk hak
              cipta.
            </>,
          ]}
        />
      ),
    },
    {
      id: "diskusi",
      title: "Aturan diskusi publik",
      content: (
        <>
          <LegalP>
            Catatan yang Anda bagikan, balasan, dan tulisan langsung di diskusi dapat dibaca siapa
            pun dan diindeks mesin pencari. Di diskusi, Anda dilarang menulis atau mengunggah:
          </LegalP>
          <LegalList
            items={[
              <>
                <strong>spam</strong>, termasuk tulisan berulang atau yang tidak berhubungan dengan
                soal, kata, atau pola yang dibahas;
              </>,
              <>
                <strong>kata-kata kasar</strong>, pelecehan, ancaman, ujaran kebencian, atau konten
                seksual;
              </>,
              <>
                <strong>data pribadi orang lain</strong>, seperti nama lengkap, kontak, alamat, atau
                foto, tanpa izin, dan sebaiknya juga data pribadi Anda sendiri;
              </>,
              <>
                <strong>promosi</strong>, iklan, ajakan bergabung ke layanan lain, atau penjualan;
              </>,
              <>konten yang melanggar hukum atau hak cipta pihak lain.</>,
            ]}
          />
          <LegalH3>Konsekuensi</LegalH3>
          <LegalP>
            Sesuai berat pelanggarannya, kami dapat menurunkan (takedown) entri, menyembunyikan
            thread, membatasi akun agar tidak dapat menulis ke diskusi publik, mencabut session, atau
            menghapus akun. Pelanggaran berat dapat ditindak tanpa peringatan sebelumnya. Jumlah
            tulisan per akun juga dibatasi secara otomatis untuk mencegah spam.
          </LegalP>
          <LegalH3>Melaporkan</LegalH3>
          <LegalP>
            Gunakan tombol <strong>Laporkan</strong> pada entri diskusi, atau form{" "}
            <LegalLink href="/report">/report</LegalLink> untuk laporan umum. Laporan dibaca admin
            secara manual, dan kami tidak selalu membalas.
          </LegalP>
        </>
      ),
    },
    {
      id: "lisensi-pengguna",
      title: "Konten yang Anda tulis",
      content: (
        <>
          <LegalP>
            Anda tetap pemilik catatan, balasan, dan gambar yang Anda buat. Anda menjamin berhak
            atas konten tersebut, termasuk gambar yang dilampirkan.
          </LegalP>
          <LegalP>
            Untuk catatan privat, Anda memberi kami izin menyimpan dan menampilkannya kepada Anda.
            Saat Anda membagikan konten ke diskusi atau menulis balasan, Anda memberi kami izin
            non-eksklusif dan bebas royalti untuk menyimpan, menampilkan secara publik, dan
            memformat konten tersebut di layanan, serta membiarkannya diindeks mesin pencari,
            selama konten itu dibagikan.
          </LegalP>
          <LegalH3>Menarik kembali dan menghapus</LegalH3>
          <LegalList
            items={[
              <>
                Konten yang ditarik ke privat atau dihapus berhenti ditampilkan. Bila sudah ada
                balasan, posisinya diganti penanda &quot;disembunyikan&quot; atau &quot;telah
                dihapus&quot; tanpa isi dan tanpa identitas Anda.
              </>,
              <>
                Balasan orang lain pada thread Anda tetap tampil, karena itu tulisan mereka.
              </>,
              <>
                Penghapusan adalah soft delete; rinciannya, termasuk apa yang masih tersimpan, ada di{" "}
                <LegalLink href={`${PRIVACY_PATH}#konten-pengguna`}>Kebijakan Privasi</LegalLink>.
                Salinan di mesin pencari pihak ketiga di luar kendali kami.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "konten-aplikasi",
      title: "Konten aplikasi",
      content: (
        <>
          <LegalList
            items={[
              <>
                <strong>Katalog flashcard dan bunpou</strong> disusun oleh Nihongofy dan ditandai
                &quot;Konten: Nihongofy&quot;. Anda boleh memakainya untuk belajar pribadi. Menyalin
                atau mendistribusikan ulang katalog secara massal memerlukan izin tertulis dari kami.
              </>,
              <>
                <strong>Pembahasan soal, isi kartu flashcard, dan isi pola bunpou ditulis dengan
                bantuan AI</strong> sehingga dapat mengandung kesalahan. Jangan menjadikannya
                satu-satunya rujukan. Bila menemukan kesalahan, gunakan tombol Laporkan di halamannya.
              </>,
              <>
                <strong>Skor dengan skala 180</strong> pada hasil mock test adalah aproksimasi yang
                dihitung dari jawaban benar per bagian dengan bobot perkiraan kami. Skor itu bukan
                scaled score resmi JLPT, karena metode penskalaan resminya tidak dipublikasikan, dan
                tidak menjamin hasil ujian yang sebenarnya.
              </>,
              <>
                Balasan dan koreksi di fitur percakapan dihasilkan AI secara otomatis dan dapat
                keliru.
              </>,
              <>
                Soal pada paket tes dapat berasal dari materi pihak ketiga, dan hak atas materi
                tersebut tetap milik pemiliknya. Bila Anda pemegang hak dan keberatan atas suatu
                konten, hubungi <ContactEmail /> agar dapat kami tinjau dan turunkan bila perlu.
              </>,
            ]}
          />
          <LegalCallout title="Tidak berafiliasi dengan penyelenggara JLPT" tone="blue">
            <p>
              Nihongofy tidak berafiliasi dengan, tidak disponsori, dan tidak didukung oleh The Japan
              Foundation maupun Japan Educational Exchanges and Services (JEES), penyelenggara
              Japanese-Language Proficiency Test. &quot;JLPT&quot; dan &quot;Japanese-Language
              Proficiency Test&quot; adalah merek milik pemiliknya masing-masing dan dipakai di sini
              hanya untuk menjelaskan materi latihan.
            </p>
          </LegalCallout>
        </>
      ),
    },
    {
      id: "tanggung-jawab",
      title: "Batasan tanggung jawab",
      content: (
        <>
          <LegalP>
            Layanan disediakan sebagaimana adanya. Kami berupaya menjaga layanan tetap tersedia dan
            isinya akurat, tetapi tidak menjamin layanan bebas gangguan, bebas kesalahan, atau
            data tidak pernah hilang. Simpan salinan data Anda lewat fitur export bila diperlukan.
          </LegalP>
          <LegalP>
            Sejauh diizinkan hukum yang berlaku, kami tidak bertanggung jawab atas kerugian tidak
            langsung yang timbul dari penggunaan layanan, termasuk hasil ujian JLPT Anda, keputusan
            yang diambil berdasarkan konten aplikasi, konten yang ditulis pengguna lain, atau
            gangguan pada layanan pihak ketiga. Ketentuan ini tidak membatasi tanggung jawab yang
            menurut hukum Indonesia tidak dapat dibatasi.
          </LegalP>
        </>
      ),
    },
    {
      id: "penghentian",
      title: "Penghentian",
      content: (
        <LegalP>
          Anda dapat berhenti kapan saja dan menghapus akun dari{" "}
          <LegalLink href="/profile/privacy">Profil &gt; Privasi</LegalLink>; prosesnya dijelaskan di{" "}
          <LegalLink href={`${PRIVACY_PATH}#hapus-akun`}>Kebijakan Privasi</LegalLink>. Kami dapat
          menangguhkan atau mengakhiri akses akun yang melanggar ketentuan ini. Ketentuan tentang
          lisensi konten yang sudah dibagikan, batasan tanggung jawab, dan hukum yang berlaku tetap
          berlaku setelah akun berakhir.
        </LegalP>
      ),
    },
    {
      id: "perubahan",
      title: "Perubahan ketentuan",
      content: (
        <LegalP>
          Kami dapat memperbarui ketentuan ini. Versi dan tanggal berlaku selalu tercantum di bagian
          atas halaman ini. Untuk perubahan yang berarti, kami akan berupaya memberi tahu lewat
          aplikasi atau email sebelum perubahan berlaku. Dengan tetap memakai layanan setelah
          tanggal berlaku, Anda dianggap menyetujui versi terbaru.
        </LegalP>
      ),
    },
    {
      id: "hukum",
      title: "Hukum yang berlaku",
      content: (
        <LegalP>
          Ketentuan ini diatur oleh hukum Negara Republik Indonesia. Perselisihan akan diupayakan
          selesai secara musyawarah terlebih dahulu; bila tidak tercapai, perselisihan diselesaikan
          melalui pengadilan yang berwenang di Indonesia.
        </LegalP>
      ),
    },
    {
      id: "kontak",
      title: "Kontak",
      content: (
        <LegalP>
          Pengelola: {operator}. Email: <ContactEmail />.
          {LEGAL_FACTS.postalAddress ? (
            <>
              {" "}
              Alamat: <LegalValue value={LEGAL_FACTS.postalAddress} />.
            </>
          ) : null}
        </LegalP>
      ),
    },
  ],
};
