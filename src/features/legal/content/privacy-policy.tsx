import { LEGAL_FACTS, PRIVACY_PATH, TERMS_PATH } from "../constants";
import {
  Code,
  ContactEmail,
  LegalCallout,
  LegalH3,
  LegalLink,
  LegalList,
  LegalP,
  LegalTable,
  LegalValue,
} from "../components/legal-blocks";
import type { LegalDocument } from "../types";

// Setiap klaim di dokumen ini harus dapat ditunjuk dasar kodenya. Saat alur data
// berubah (cookie baru, pemroses baru, retensi baru), perbarui bagian yang
// relevan, naikkan VERSION, dan ganti LAST_UPDATED. Riwayatnya cukup lewat git.
export const VERSION = "1.4";
export const LAST_UPDATED = "2026-10-10";
export const EFFECTIVE_DATE = "2026-10-10";

const operator = <LegalValue value={LEGAL_FACTS.operatorName} />;

export const PRIVACY_POLICY: LegalDocument = {
  title: "Kebijakan Privasi",
  description:
    "Data apa yang dikumpulkan Nihongofy, untuk apa, siapa pemrosesnya, berapa lama disimpan, dan cara Anda mengekspor atau menghapusnya.",
  path: PRIVACY_PATH,
  kicker: "Privasi",
  version: VERSION,
  lastUpdated: LAST_UPDATED,
  effectiveDate: EFFECTIVE_DATE,
  summary: (
    <>
      <p>
        Kebijakan ini menjelaskan data pribadi yang diproses Nihongofy (jlpt.lans.my.id), sesuai
        dengan cara aplikasi ini benar-benar bekerja. Ringkasnya:
      </p>
      <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-base leading-7">
        <li>Tidak ada iklan, analytics pihak ketiga, atau cookie pelacak.</li>
        <li>Catatan Anda privat sampai Anda sendiri membagikannya ke diskusi.</li>
        <li>
          Diskusi yang dibagikan dapat dibaca siapa pun, diindeks mesin pencari, dan menampilkan nama
          tampilan, username, serta avatar Anda.
        </li>
        <li>
          Profil belajar Anda di <Code>/u/username</Code> bersifat publik secara bawaan dan diindeks
          mesin pencari. Anda dapat menjadikannya private kapan saja.
        </li>
        <li>
          Postingan komunitas dari akun public dapat dibaca siapa pun dan diindeks; postingan dari
          akun private hanya terlihat oleh Anda dan follower yang Anda setujui.
        </li>
        <li>Anda dapat mengunduh data akun dan menghapus akun sendiri dari halaman profil.</li>
      </ul>
    </>
  ),
  sections: [
    {
      id: "pengendali",
      title: "Siapa kami",
      content: (
        <>
          <LegalP>
            Nihongofy adalah platform belajar bahasa Jepang dan simulasi JLPT yang dikelola oleh{" "}
            {operator} (&quot;kami&quot;). Untuk data pribadi yang dijelaskan di sini, kami
            bertindak sebagai Pengendali Data Pribadi sebagaimana dimaksud Undang-Undang Nomor 27
            Tahun 2022 tentang Pelindungan Data Pribadi (&quot;UU PDP&quot;).
          </LegalP>
          <LegalP>
            Pertanyaan atau permintaan terkait data pribadi dapat dikirim ke <ContactEmail />
            {LEGAL_FACTS.postalAddress ? (
              <>
                {" "}
                atau ke alamat <LegalValue value={LEGAL_FACTS.postalAddress} />
              </>
            ) : null}
            .
          </LegalP>
          <LegalP>
            Kebijakan ini dibaca bersama{" "}
            <LegalLink href={TERMS_PATH}>Syarat & Ketentuan</LegalLink>.
          </LegalP>
        </>
      ),
    },
    {
      id: "data-akun",
      title: "Data akun",
      content: (
        <>
          <LegalP>Saat Anda mendaftar dan memakai akun, kami menyimpan:</LegalP>
          <LegalList
            items={[
              <>
                <strong>Email.</strong> Disimpan dalam huruf kecil dan dipakai sebagai satu-satunya
                identitas login. Email tidak dapat diubah dari aplikasi setelah akun dibuat.
              </>,
              <>
                <strong>Nama tampilan</strong> dan <strong>username publik</strong>. Username dibuat
                otomatis saat mendaftar dan dapat Anda ubah. Username bukan kredensial login.
              </>,
              <>
                <strong>Password</strong>, hanya dalam bentuk hash bcrypt. Password asli tidak pernah
                disimpan atau dicatat di log. Akun yang dibuat lewat Google tidak memiliki password
                sampai Anda membuatnya.
              </>,
              <>
                <strong>Avatar.</strong> Gambar yang Anda unggah dipotong dan diperkecil menjadi
                512×512 WebP di perangkat Anda, lalu disimpan di Cloudflare R2. Avatar lama dihapus
                dari penyimpanan saat diganti atau dilepas.
              </>,
              <>
                <strong>Zona waktu</strong> (bawaan Asia/Jakarta), dipakai untuk batas hari
                flashcard, format tanggal, dan batas hari pada jejak belajar di profil publik.
              </>,
              <>
                <strong>Bio dan target level JLPT</strong> bila Anda mengisinya, serta pilihan
                visibility profil publik (public atau private).
              </>,
              <>
                <strong>Relasi follow:</strong> akun yang Anda ikuti, akun yang mengikuti Anda,
                permintaan follow yang menunggu, dan kapan permintaan disetujui.
              </>,
              <>
                Status verifikasi email, preferensi privasi, tanggal pembuatan akun, peran akun
                (pengguna atau admin), dan jadwal penghapusan akun bila Anda memintanya.
              </>,
            ]}
          />
          <LegalH3>Masuk dengan Google</LegalH3>
          <LegalP>
            Bila Anda memilih masuk dengan Google, kami meminta cakupan <Code>openid</Code>,{" "}
            <Code>email</Code>, dan <Code>profile</Code>. Yang kami simpan adalah ID akun Google
            Anda (<Code>sub</Code>) sebagai penanda tetap, alamat email Google, serta nama dan URL
            foto profil Google saat akun pertama kali dibuat. Foto tersebut tetap dimuat dari server
            Google.
          </LegalP>
          <LegalP>
            Kami <strong>tidak</strong> menyimpan access token maupun refresh token Google. ID token
            dari Google hanya diverifikasi saat login lalu dibuang, sehingga kami tidak dapat
            mengakses Gmail, Drive, kontak, atau data Google Anda yang lain.
          </LegalP>
        </>
      ),
    },
    {
      id: "data-belajar",
      title: "Data belajar",
      content: (
        <>
          <LegalP>Untuk menyimpan progres, kami mencatat aktivitas belajar Anda:</LegalP>
          <LegalList
            items={[
              <>
                <strong>Mock test dan latihan per seksi:</strong> paket yang dikerjakan, jawaban yang
                dipilih, benar atau salah, tanda ragu-ragu, serta waktu mulai dan selesai.
              </>,
              <>
                <strong>Latihan cepat:</strong> level, seksi, jenis soal, urutan soal, jawaban, dan
                waktu menjawab.
              </>,
              <>
                <strong>Kana:</strong> berapa kali tiap huruf dilihat, dijawab benar, atau diulang.
              </>,
              <>
                <strong>Flashcard:</strong> deck yang Anda ikuti beserta pengaturannya, jadwal tiap
                kartu, dan riwayat review (waktu, penilaian, dan lama menjawab), serta pengaturan
                tampilan.
              </>,
              <>
                <strong>Artikel:</strong> artikel yang Anda simpan atau favoritkan dan kapan terakhir
                dibaca.
              </>,
            ]}
          />
          <LegalP>
            Halaman dashboard, history, progress, dan analytics hanya menghitung ulang data di atas
            untuk Anda sendiri.
          </LegalP>
          <LegalH3>Tanpa akun (tamu)</LegalH3>
          <LegalP>
            Tamu dapat mengerjakan mock test dan latihan cepat tanpa mendaftar. Hasilnya tidak
            disimpan di database kami: lembar jawaban hanya ada di <Code>sessionStorage</Code> tab
            browser Anda dan hilang saat tab ditutup, sedangkan paket dan daftar soal yang sedang
            dikerjakan disimpan di cookie sesi browser (lihat bagian Cookie).
          </LegalP>
          <LegalP>
            Bila Anda menekan tombol untuk menyimpan hasil ujian tamu ke akun, lembar jawaban
            dititipkan di server selama paling lama 24 jam agar dapat diklaim setelah Anda masuk atau
            selesai memverifikasi email. Titipan itu sekali pakai: setelah diklaim, ia menjadi
            attempt di akun Anda dan titipannya dihapus. Skor dihitung ulang di server dari kunci
            jawaban.
          </LegalP>
        </>
      ),
    },
    {
      id: "konten-pengguna",
      title: "Catatan, diskusi, dan gambar",
      content: (
        <>
          <LegalP>
            Pada soal, kata flashcard, dan pola bunpou, Anda dapat menulis catatan, membalas entri
            orang lain, menyebut (mention) entri tertentu, dan melampirkan gambar.
          </LegalP>
          <LegalList
            items={[
              <>
                <strong>Catatan bersifat privat secara bawaan.</strong> Catatan privat hanya
                ditampilkan kepada Anda.
              </>,
              <>
                <strong>Catatan menjadi publik hanya bila Anda membagikannya</strong> ke diskusi, atau
                bila Anda menulis langsung di kolom diskusi. Balasan selalu publik karena mengikuti
                thread tempatnya ditulis.
              </>,
              <>
                Mention disimpan sebagai tautan ke entri yang dituju, bukan sebagai teks nama, dan
                tidak ditampilkan lagi bila entri tujuannya dihapus.
              </>,
            ]}
          />
          <LegalCallout title="Penting: diskusi publik terlihat siapa pun" tone="coral">
            <p>
              Entri diskusi yang dibagikan dapat dibaca siapa pun tanpa login dan{" "}
              <strong>diindeks oleh mesin pencari</strong> (diskusi soal, kata, dan pola bunpou).
              Setiap entri menampilkan <strong>nama tampilan, username, dan avatar</strong> Anda.
            </p>
            <p>
              Jangan menulis data pribadi Anda maupun orang lain di diskusi. Setelah halaman
              terindeks, salinan di mesin pencari atau arsip pihak ketiga dapat bertahan sampai
              mereka memperbaruinya, dan itu di luar kendali kami.
            </p>
          </LegalCallout>
          <LegalH3>Menarik kembali dan menghapus</LegalH3>
          <LegalList
            items={[
              <>
                Entri yang ditarik kembali ke privat berhenti tampil di diskusi. Bila sudah ada
                balasan, entri itu digantikan penanda &quot;disembunyikan&quot; tanpa isi dan tanpa
                identitas Anda, dan balasan orang lain tetap terbaca.
              </>,
              <>
                Entri yang Anda hapus tidak lagi ditampilkan; root yang punya balasan menjadi penanda
                &quot;telah dihapus&quot;. Penghapusan ini bersifat <em>soft delete</em>:{" "}
                <strong>
                  isi entri saat ini masih tersimpan di database kami walaupun tidak ditampilkan
                </strong>
                , supaya thread dan balasan orang lain tetap utuh.
              </>,
              <>
                <strong>Gambar lampiran</strong> disimpan di Cloudflare R2 dengan alamat acak yang
                sulit ditebak, tetapi tidak dilindungi login: siapa pun yang memegang tautannya dapat
                membukanya, termasuk lampiran pada catatan privat. File gambar saat ini tidak dihapus
                otomatis, termasuk saat entrinya dihapus.
              </>,
            ]}
          />
          <LegalH3>Moderasi</LegalH3>
          <LegalP>
            Admin dapat menyembunyikan thread, menurunkan (takedown) entri, memulihkan entri yang
            diturunkan admin, dan membatasi akun agar tidak dapat menulis ke diskusi publik. Status
            pembatasan dan alasannya dicatat pada akun. Setiap tindakan admin dicatat di log audit
            internal yang memuat jenis tindakan dan targetnya, tanpa isi konten. Menulis ke diskusi
            dibatasi jumlahnya per akun untuk mencegah spam.
          </LegalP>
        </>
      ),
    },
    {
      id: "profil-publik",
      title: "Profil publik",
      content: (
        <>
          <LegalP>
            Setiap akun memiliki halaman profil di <Code>/u/username</Code>. Isinya dihitung dari data
            belajar yang sudah kami simpan; tidak ada data baru yang dikumpulkan untuknya.
          </LegalP>
          <LegalList
            items={[
              <>
                <strong>Selalu tampil:</strong> avatar, nama tampilan, username, bio, target level,
                bulan bergabung, dan keterangan bila akun private.
              </>,
              <>
                <strong>Tampil bila profil public (bawaan):</strong> jumlah kana yang pernah dijawab
                benar, kata flashcard yang dipelajari, latihan cepat, latihan seksi, dan mock test
                yang selesai; jejak belajar 12 bulan terakhir berupa jumlah review flashcard,
                latihan cepat, dan ujian yang selesai <strong>per hari</strong> menurut zona waktu
                Anda, beserta streak; serta jumlah entri diskusi publik dan suara &quot;Membantu&quot;
                yang diterimanya.
              </>,
              <>
                <strong>Tidak pernah tampil:</strong> skor, jawaban, nama paket yang dikerjakan,
                analytics, history, percakapan AI, email, zona waktu, dan jam aktivitas.
              </>,
              <>
                <strong>Private:</strong> orang lain, termasuk mesin pencari, hanya melihat bagian
                &quot;selalu tampil&quot;, kecuali follower yang sudah Anda setujui. Datanya tetap
                tersimpan dan tetap ditampilkan untuk Anda sendiri. Pengaturannya ada di{" "}
                <LegalLink href="/profile/privacy">Profil &gt; Privasi</LegalLink>.
              </>,
              <>
                <strong>Follow:</strong> jumlah follower dan jumlah akun yang Anda ikuti selalu
                tampil. Daftar namanya mengikuti aturan yang sama dengan isi profil: terbuka untuk
                profil public, dan untuk profil private hanya bagi Anda serta follower yang disetujui.
                Daftar follow tidak diindeks mesin pencari. Mengikuti akun private mengirim
                permintaan yang dapat disetujui atau ditolak pemiliknya; menjadikan akun public
                menyetujui semua permintaan yang masih menunggu. Anda dapat berhenti mengikuti,
                membatalkan permintaan, atau menghapus follower kapan saja tanpa pemberitahuan ke
                pihak lain.
              </>,
              <>
                Akun yang dibuat sebelum fitur ini ada menjadi public secara otomatis, dan kami
                memberi tahu pemiliknya lewat pemberitahuan di dashboard.
              </>,
              <>
                Akun yang sedang dalam masa tunggu penghapusan atau sudah dihapus tidak memiliki
                halaman profil.
              </>,
            ]}
          />
          <LegalCallout title="Profil public dapat diindeks mesin pencari" tone="coral">
            <p>
              Profil public dapat dibaca tanpa login dan diindeks mesin pencari. Setelah Anda
              mengubahnya menjadi private, halaman kami langsung berhenti menampilkan isinya, tetapi
              salinan di mesin pencari dapat bertahan sampai mereka memperbaruinya.
            </p>
          </LegalCallout>
        </>
      ),
    },
    {
      id: "postingan",
      title: "Postingan komunitas",
      content: (
        <>
          <LegalP>
            Di <LegalLink href="/community">Komunitas</LegalLink> Anda dapat menulis postingan teks
            dengan gambar, menyukai postingan orang lain, dan berkomentar. Kami menyimpan isi
            postingan, gambar lampiran, waktu dibuat dan disunting, siapa yang menyukai postingan
            mana, serta komentar Anda.
          </LegalP>
          <LegalList
            items={[
              <>
                <strong>Siapa yang melihat</strong> ditentukan visibility profil Anda. Postingan dari
                akun public tampil di feed Komunitas, di profil Anda, dan di halamannya sendiri; dapat
                dibaca tanpa login dan diindeks mesin pencari. Postingan dari akun private tidak masuk
                feed Komunitas dan hanya terlihat oleh Anda serta follower yang Anda setujui.
              </>,
              <>
                Setiap postingan dan komentar menampilkan <strong>nama tampilan, username, dan
                avatar</strong> Anda. Jumlah like ditampilkan, tetapi siapa yang menyukai tidak.
              </>,
              <>
                Komentar di postingan selalu mengikuti siapa yang boleh melihat postingannya.
                Komentar Anda di postingan public orang lain tetap terlihat walaupun akun Anda
                private.
              </>,
              <>
                Postingan yang Anda hapus berhenti tampil. Bila sudah ada komentar, postingan diganti
                keterangan &quot;telah dihapus&quot; tanpa isi dan tanpa identitas Anda, dan komentar
                orang lain tetap terbaca. Seperti diskusi, penghapusan ini <em>soft delete</em>: isi
                postingan masih tersimpan di database tanpa ditampilkan, dan file gambar tidak dihapus
                otomatis.
              </>,
              <>
                Admin dapat menurunkan (takedown) postingan dan membatasi akun agar tidak dapat
                memposting. Membuat dan menyunting postingan dibatasi jumlahnya per akun untuk
                mencegah spam.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "laporan",
      title: "Laporan",
      content: (
        <>
          <LegalP>
            Anda dapat melaporkan bug, kesalahan isi, atau penyalahgunaan lewat{" "}
            <LegalLink href="/report">/report</LegalLink> atau tombol Laporkan, dengan atau tanpa
            akun. Laporan menyimpan kategori, pesan Anda, item yang dilaporkan, path halaman tempat
            laporan dikirim (tanpa query string), dan user agent browser Anda. Tamu harus melewati
            Cloudflare Turnstile.
          </LegalP>
          <LegalList
            items={[
              <>
                <strong>Tamu</strong> boleh mengisi alamat email untuk dibalas. Kolom ini opsional.
              </>,
              <>
                <strong>Pengguna yang login</strong> hanya dibalas bila mencentang opsi balasan ke
                email akun; alamatnya diambil dari akun Anda di server.
              </>,
              <>
                Email balasan hanya dipakai untuk menjawab laporan tersebut. Balasan dikirim manual
                oleh admin, paling banyak satu kali, dan tidak mengutip isi laporan Anda.
              </>,
              <>
                Alamat email balasan dikosongkan otomatis <strong>90 hari</strong> setelah laporan
                ditutup. Isi laporannya tetap disimpan sebagai riwayat perbaikan.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "percakapan",
      title: "Percakapan dan Bicara (AI)",
      content: (
        <>
          <LegalP>
            Bagian ini berlaku bila fitur Percakapan dan Bicara sedang tersedia. Keduanya hanya dapat
            dipakai setelah login.
          </LegalP>
          <LegalH3>Yang dikirim ke penyedia AI</LegalH3>
          <LegalP>
            Untuk menghasilkan balasan, server kami mengirim pesan Anda, riwayat percakapan pada sesi
            tersebut (teks bahasa Jepang), serta instruksi persona, level, dan topik ke penyedia
            model AI (<LegalValue value={LEGAL_FACTS.aiProvider} />). Untuk umpan balik koreksi, yang dikirim adalah kalimat yang ingin Anda
            periksa. Nama, email, username, dan ID akun Anda tidak ikut dikirim. Pemrosesan di sisi
            penyedia tunduk pada ketentuan penyedia tersebut. Jangan menuliskan data pribadi di
            percakapan.
          </LegalP>
          <LegalH3>Penyimpanan transkrip</LegalH3>
          <LegalList
            items={[
              <>
                Penyimpanan percakapan <strong>mati secara bawaan</strong> dan dapat diatur di{" "}
                <LegalLink href="/profile/privacy">Profil &gt; Privasi</LegalLink>.
              </>,
              <>
                Bila aktif saat sesi dibuat, isi tiap giliran (teks Jepang, terjemahan, romaji, dan
                umpan balik) disimpan agar sesi dapat dilanjutkan. Bila mati, isi percakapan tidak
                disimpan; yang tersimpan hanya data sesi seperti persona, level, topik, waktu, dan
                jumlah giliran.
              </>,
              <>
                Pilihan itu dicatat per sesi saat sesi dibuat. Mengubah preferensi berlaku untuk sesi
                berikutnya, bukan sesi yang sudah ada.
              </>,
              <>
                Pemakaian harian (jumlah giliran dan token) selalu dicatat, juga saat isi percakapan
                tidak disimpan.
              </>,
              <>
                Saat ini belum ada penghapusan otomatis: transkrip yang disimpan bertahan sampai Anda
                menghapus sesinya atau menghapus akun.
              </>,
            ]}
          />
          <LegalH3>Suara</LegalH3>
          <LegalP>
            Pengenalan suara dan suara karakter memakai Web Speech API milik browser Anda. Rekaman
            mikrofon tidak dikirim ke server kami dan tidak kami simpan; yang sampai ke server hanya
            teks hasil pengenalan. Sebagian browser (misalnya Chrome) memproses audio pengenalan
            suara di server penyedia browser, dan hal itu tunduk pada kebijakan penyedia browser
            Anda. Pengaturan izin penyimpanan audio sudah tersedia, tetapi aplikasi saat ini tidak
            menyimpan rekaman audio sama sekali.
          </LegalP>
        </>
      ),
    },
    {
      id: "email",
      title: "Email",
      content: (
        <>
          <LegalP>
            Kami hanya mengirim email transaksional, melalui SMTP{" "}
            <LegalValue value={LEGAL_FACTS.smtpProvider} />:
          </LegalP>
          <LegalList
            items={[
              <>verifikasi email saat mendaftar (tautan berlaku 30 menit);</>,
              <>reset password (tautan berlaku 15 menit);</>,
              <>balasan laporan, hanya bila Anda memintanya.</>,
            ]}
          />
          <LegalP>
            Tidak ada newsletter atau email promosi. Token pada tautan email disimpan hanya sebagai
            hash SHA-256, dan pengiriman ulang dibatasi jedanya.
          </LegalP>
        </>
      ),
    },
    {
      id: "keamanan-teknis",
      title: "Data teknis dan keamanan",
      content: (
        <>
          <LegalList
            items={[
              <>
                <strong>Alamat IP</strong> dipakai untuk membatasi percobaan login, pendaftaran,
                pengiriman email, laporan, dan tindakan sensitif lain. Penghitungnya hanya menyimpan
                hash HMAC-SHA256 dari IP, email, atau ID akun, bukan nilai aslinya. Alamat IP tidak
                disimpan mentah di database.
              </>,
              <>
                Pada form yang dijaga Cloudflare Turnstile, token tantangan dan alamat IP Anda
                dikirim ke Cloudflare untuk diverifikasi.
              </>,
              <>
                <strong>User agent</strong> diringkas menjadi label perangkat (misalnya &quot;Chrome
                di macOS&quot;) untuk daftar perangkat aktif di{" "}
                <LegalLink href="/profile/security">Profil &gt; Keamanan</LegalLink>. User agent
                lengkap hanya disimpan pada laporan yang Anda kirim.
              </>,
              <>
                Log aplikasi kami menyamarkan kolom seperti email, username, nama tampilan, alamat
                IP, ID akun, password, dan token sebelum dicatat. Penyedia hosting dapat mencatat log permintaan teknis
                sendiri sesuai kebijakannya.
              </>,
            ]}
          />
          <LegalP>
            Langkah keamanan lain: cookie session yang tidak dapat dibaca JavaScript, registry
            session yang dapat dicabut per perangkat, pencabutan semua session saat password diganti
            atau direset, dan akses database hanya dari server aplikasi. Tidak ada sistem yang aman
            sepenuhnya. Bila terjadi kegagalan pelindungan data pribadi, kami akan memberi tahu
            sesuai kewajiban UU PDP.
          </LegalP>
        </>
      ),
    },
    {
      id: "cookie",
      title: "Cookie dan penyimpanan browser",
      content: (
        <>
          <LegalP>
            Semua cookie di bawah dipasang oleh aplikasi ini, bersifat <Code>httpOnly</Code>,{" "}
            <Code>Secure</Code>, dan <Code>SameSite=Lax</Code>, dan diperlukan agar fitur terkait
            berjalan. Kami tidak memakai cookie iklan maupun analytics.
          </LegalP>
          <LegalTable
            caption="Daftar cookie yang dipasang aplikasi"
            head={["Nama", "Fungsi", "Masa berlaku"]}
            rows={[
              [
                <Code key="n">session</Code>,
                "Token login (JWT bertanda tangan) berisi ID akun dan ID session.",
                "7 hari, atau lebih singkat bila akun dijadwalkan dihapus",
              ],
              [
                <Code key="n">pending_email_verification</Code>,
                "Menandai akun yang menunggu verifikasi email: ID akun, email, dan halaman tujuan setelah login.",
                "24 jam",
              ],
              [
                <Code key="n">google_oauth_state</Code>,
                "Mengikat proses login Google ke browser ini. Hanya dikirim ke /api/auth/google.",
                "10 menit",
              ],
              [
                <Code key="n">google_oauth_reauth</Code>,
                "Bukti sekali pakai bahwa Anda baru memverifikasi ulang akun Google untuk tindakan sensitif.",
                "5 menit",
              ],
              [
                <Code key="n">guest_attempt_stash</Code>,
                "Token acak yang menunjuk titipan jawaban ujian tamu yang akan disimpan ke akun.",
                "24 jam atau sampai diklaim",
              ],
              [
                <Code key="n">jlpt_guest_exam</Code>,
                "Paket, seksi, dan waktu mulai mock test tamu.",
                "Sampai browser ditutup",
              ],
              [
                <Code key="n">jlpt_guest_practice</Code>,
                "Level, seksi, jenis soal, dan daftar soal latihan cepat tamu.",
                "Sampai browser ditutup",
              ],
            ]}
          />
          <LegalP>
            Selain cookie, lembar jawaban ujian yang sedang dikerjakan disimpan di{" "}
            <Code>sessionStorage</Code> tab browser supaya tidak hilang saat halaman dimuat ulang.
            Isinya hilang saat tab ditutup.
          </LegalP>
          <LegalP>
            Halaman masuk, daftar, lupa password, verifikasi email, dan form laporan untuk tamu
            memuat widget Cloudflare Turnstile dari <Code>challenges.cloudflare.com</Code>. Widget
            itu memeriksa sinyal browser untuk membedakan manusia dari bot dan dapat memakai
            penyimpanannya sendiri; pemrosesan tersebut tunduk pada kebijakan privasi Cloudflare.
          </LegalP>
        </>
      ),
    },
    {
      id: "analytics",
      title: "Analytics dan pelacakan",
      content: (
        <LegalP>
          Nihongofy tidak memasang analytics pihak ketiga, pixel iklan, atau skrip pelacak, dan tidak
          menjual data pribadi. Menu &quot;Analytics&quot; di aplikasi adalah statistik belajar Anda
          sendiri yang dihitung dari data di bagian Data belajar. Font aplikasi di-host bersama
          aplikasi, bukan dimuat dari layanan font pihak ketiga.
        </LegalP>
      ),
    },
    {
      id: "dasar-tujuan",
      title: "Tujuan dan dasar pemrosesan",
      content: (
        <>
          <LegalP>Dasar pemrosesan mengacu pada UU PDP.</LegalP>
          <LegalTable
            caption="Tujuan dan dasar pemrosesan data"
            head={["Tujuan", "Data", "Dasar pemrosesan"]}
            rows={[
              [
                "Membuat dan menjalankan akun, menyimpan progres belajar",
                "Data akun, data belajar",
                "Pemenuhan perjanjian (Syarat & Ketentuan)",
              ],
              [
                "Mengirim email verifikasi dan reset password",
                "Email",
                "Pemenuhan perjanjian",
              ],
              [
                "Menampilkan entri di diskusi publik",
                "Isi entri, nama tampilan, username, avatar",
                "Persetujuan, yang Anda berikan dengan membagikan atau menulis di diskusi",
              ],
              [
                "Menampilkan profil publik",
                "Nama tampilan, username, avatar, bio, target level, penghitung dan jejak belajar harian",
                "Kepentingan yang sah untuk fitur komunitas belajar; Anda dapat menolaknya kapan saja dengan menjadikan profil private",
              ],
              [
                "Menampilkan postingan komunitas",
                "Isi postingan, gambar, like, komentar, nama tampilan, username, avatar",
                "Persetujuan, yang Anda berikan dengan memposting atau berkomentar",
              ],
              [
                "Fitur follow",
                "Relasi follow dan permintaan follow",
                "Pemenuhan perjanjian, untuk fitur yang Anda gunakan sendiri",
              ],
              [
                "Menyimpan transkrip percakapan AI",
                "Isi percakapan",
                "Persetujuan (opt-in di Profil > Privasi)",
              ],
              [
                "Membalas laporan lewat email",
                "Email balasan",
                "Persetujuan (mengisi atau mencentang opsi balasan)",
              ],
              [
                "Keamanan, pencegahan penyalahgunaan, dan moderasi",
                "Hash IP dan email, data session, Turnstile, log audit",
                "Kepentingan yang sah untuk menjaga layanan dan penggunanya",
              ],
            ]}
          />
          <LegalP>
            Persetujuan dapat Anda tarik kapan saja: menarik entri ke privat, mematikan penyimpanan
            percakapan, menjadikan profil private, atau menghapus akun. Penarikan tidak memengaruhi pemrosesan yang sudah
            terjadi sebelumnya.
          </LegalP>
        </>
      ),
    },
    {
      id: "pemroses",
      title: "Pihak ketiga yang memproses data",
      content: (
        <>
          <LegalP>
            Kami memakai penyedia berikut untuk menjalankan layanan. Mereka memproses data hanya
            sejauh yang diperlukan untuk fungsinya masing-masing.
          </LegalP>
          <LegalTable
            caption="Pemroses data pihak ketiga"
            head={["Penyedia", "Untuk apa", "Data yang terlibat"]}
            rows={[
              [
                "Vercel",
                "Hosting aplikasi dan penjadwal tugas harian",
                "Seluruh permintaan ke aplikasi, termasuk alamat IP dan user agent",
              ],
              [
                "Supabase",
                <>
                  Database PostgreSQL, region <LegalValue key="r" value={LEGAL_FACTS.databaseRegion} />
                </>,
                "Data akun, data belajar, catatan dan diskusi, laporan, percakapan yang disimpan",
              ],
              [
                "Upstash",
                "Redis untuk session, transaksi login Google, titipan jawaban tamu, jeda email, dan batas tulis diskusi",
                "ID session, label perangkat, waktu aktivitas, ID akun, jawaban tamu (maks. 24 jam)",
              ],
              [
                "Cloudflare",
                "R2 untuk media bank soal, avatar, dan gambar lampiran; Turnstile untuk verifikasi bot",
                "File audio dan gambar; token Turnstile dan alamat IP",
              ],
              [
                <LegalValue key="s" value={LEGAL_FACTS.smtpProvider} />,
                "Pengiriman email transaksional",
                "Alamat email penerima dan isi email",
              ],
              [
                <LegalValue key="a" value={LEGAL_FACTS.aiProvider} />,
                "Balasan dan koreksi percakapan AI, bila fitur tersedia",
                "Teks percakapan, tanpa identitas akun",
              ],
              [
                "Google",
                "Login dengan Google, bila Anda memilihnya",
                "Google mengetahui bahwa Anda masuk ke Nihongofy; foto profil Google dimuat dari server Google",
              ],
              [
                "Cloudinary",
                "Avatar dan gambar lampiran lama sebelum migrasi storage, hanya dibaca",
                "Browser Anda memuat file langsung dari Cloudinary, sehingga Cloudinary menerima alamat IP dan user agent",
              ],
            ]}
          />
          <LegalP>
            Sebagian penyedia di atas menyimpan atau memproses data di luar wilayah Indonesia.
            Transfer tersebut dilakukan untuk menjalankan layanan sebagaimana dijelaskan di sini.
            Kami tidak menjual atau menyewakan data pribadi, dan hanya mengungkapkannya kepada pihak
            lain bila diwajibkan oleh hukum.
          </LegalP>
        </>
      ),
    },
    {
      id: "retensi",
      title: "Berapa lama data disimpan",
      content: (
        <LegalTable
          caption="Masa simpan data"
          head={["Data", "Masa simpan"]}
          rows={[
            ["Akun dan data belajar", "Selama akun aktif; dihapus saat penghapusan akun dijalankan"],
            [
              "Session login",
              "7 hari. Maksimal 20 perangkat aktif per akun; yang tertua dicabut otomatis",
            ],
            [
              "Tautan verifikasi email dan reset password",
              "30 menit dan 15 menit; token kedaluwarsa dibersihkan tugas harian",
            ],
            ["Transaksi login Google dan bukti verifikasi ulang", "10 menit dan 5 menit, sekali pakai"],
            ["Titipan jawaban ujian tamu", "24 jam, atau sampai diklaim ke akun"],
            ["Hasil ujian dan latihan tamu", "Tidak disimpan di server; hanya di tab browser"],
            [
              "Penghitung pembatas percobaan (hash IP atau email)",
              "Dihapus 7 hari setelah aktivitas terakhir; jeda kirim email 60 detik",
            ],
            ["Email balasan laporan", "Dikosongkan 90 hari setelah laporan ditutup"],
            ["Isi laporan", "Tidak dihapus otomatis; disimpan sebagai riwayat perbaikan"],
            ["Transkrip percakapan yang disimpan", "Sampai sesi atau akun Anda hapus"],
            [
              "Catatan dan entri diskusi yang dihapus",
              "Tidak ditampilkan, tetapi isinya masih tersimpan di database; gambar lampiran tidak dihapus otomatis",
            ],
            ["Avatar yang diganti atau dilepas", "Dihapus dari R2; upload yang tidak terpakai dibersihkan setelah 2 jam"],
            ["Log audit tindakan admin", "Disimpan permanen sebagai catatan akuntabilitas"],
          ]}
        />
      ),
    },
    {
      id: "hapus-akun",
      title: "Penghapusan akun",
      content: (
        <>
          <LegalP>
            Anda dapat menghapus akun dari{" "}
            <LegalLink href="/profile/privacy">Profil &gt; Privasi</LegalLink> dengan mengetik frasa{" "}
            <Code>HAPUS AKUN</Code> dan memasukkan password, atau memverifikasi ulang akun Google
            bila akun Anda tidak memiliki password.
          </LegalP>
          <LegalList
            items={[
              <>Semua session di semua perangkat langsung dicabut.</>,
              <>
                Ada <strong>masa tunggu 7 hari</strong>. Selama masa itu Anda dapat login dan
                membatalkan penghapusan. Setelah masa tunggu lewat, login ditolak.
              </>,
              <>Penghapusan dijalankan oleh tugas terjadwal harian setelah masa tunggu berakhir.</>,
            ]}
          />
          <LegalH3>Yang dihapus</LegalH3>
          <LegalP>
            Progres kana, seluruh data flashcard (kartu, riwayat review, langganan deck, dan
            pengaturan), latihan cepat, attempt ujian, interaksi artikel, relasi follow di kedua
            arah (termasuk permintaan yang menunggu), like postingan yang Anda berikan, sesi dan pemakaian
            percakapan, token email, koneksi akun Google, dan file avatar di R2.
          </LegalP>
          <LegalH3>Yang dianonimkan atau tetap ada</LegalH3>
          <LegalList
            items={[
              <>
                Baris akun tidak dihapus, melainkan dianonimkan: nama tampilan menjadi
                &quot;Pengguna dihapus&quot;, email, password, dan avatar dikosongkan, dan preferensi
                dikembalikan ke bawaan. Bio dan target level dikosongkan, dan halaman profil publik
                tidak lagi tersedia sejak penghapusan diminta. Username diganti menjadi{" "}
                <Code>&lt;username lama&gt;_&lt;waktu&gt;_deleted</Code>, sehingga{" "}
                <strong>username lama tetap tercatat</strong> di dalamnya. Email yang sama dapat
                dipakai mendaftar lagi.
              </>,
              <>
                Catatan, entri diskusi, dan postingan Anda di-soft-delete. Thread yang sudah dibalas orang lain
                tetap ada dengan penanda &quot;telah dihapus&quot;, dan{" "}
                <strong>balasan orang lain tetap tampil</strong> karena merupakan tulisan mereka. Isi
                entri Anda masih tersimpan di database tanpa ditampilkan, dan gambar lampiran tidak
                dihapus otomatis.
              </>,
              <>
                Laporan yang pernah Anda kirim tetap disimpan, tetapi tautannya ke akun dan alamat
                email balasannya dikosongkan.
              </>,
              <>
                Bila Anda admin, log audit tindakan Anda dipertahankan dengan nama &quot;Pengguna
                dihapus&quot;.
              </>,
              <>
                Avatar yang diunggah sebelum penyimpanan pindah ke Cloudflare R2 masih berada di
                Cloudinary dan tidak terhapus otomatis. Hubungi kami bila Anda ingin file itu dihapus.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "hak-anda",
      title: "Hak Anda dan cara menjalankannya",
      content: (
        <>
          <LegalP>
            Sebagai subjek data pribadi menurut UU PDP, Anda berhak antara lain atas informasi
            tentang pemrosesan, akses dan salinan data, perbaikan, penghapusan, penarikan
            persetujuan, keberatan, penundaan atau pembatasan pemrosesan, dan pemindahan data.
          </LegalP>
          <LegalTable
            caption="Cara menjalankan hak subjek data"
            head={["Hak", "Cara"]}
            rows={[
              [
                "Mendapat salinan data",
                <>
                  Tombol <strong>Unduh JSON</strong> di{" "}
                  <LegalLink key="l" href="/profile/privacy">
                    Profil &gt; Privasi
                  </LegalLink>{" "}
                  (<Code key="c">/api/account/export</Code>). Isinya: profil dan preferensi, koneksi
                  Google, status pembatasan posting, progres kana, flashcard, attempt, latihan cepat,
                  catatan dan entri diskusi, interaksi artikel, dan laporan yang Anda kirim. Tidak
                  termasuk password, token, session, data pembatas percobaan, catatan internal admin,
                  dan saat ini data percakapan AI.
                </>,
              ],
              [
                "Memperbaiki data",
                <>
                  Nama tampilan, username, avatar, dan zona waktu di{" "}
                  <LegalLink key="l" href="/profile/info">
                    Profil &gt; Info
                  </LegalLink>
                  ; password dan koneksi Google di{" "}
                  <LegalLink key="s" href="/profile/security">
                    Profil &gt; Keamanan
                  </LegalLink>
                  . Email tidak dapat diubah dari aplikasi; hubungi kami bila perlu.
                </>,
              ],
              [
                "Menghapus data",
                "Hapus catatan atau entri, hapus sesi percakapan, atau hapus akun (lihat bagian Penghapusan akun)",
              ],
              [
                "Menarik persetujuan",
                "Tarik entri diskusi ke privat, atau matikan penyimpanan percakapan di Profil > Privasi",
              ],
              [
                "Keberatan, pembatasan, atau permintaan lain",
                <>
                  Kirim permintaan ke <ContactEmail key="e" />. Kami dapat meminta verifikasi bahwa
                  permintaan berasal dari pemilik akun.
                </>,
              ],
            ]}
          />
          <LegalP>
            Anda juga dapat menyampaikan pengaduan kepada lembaga penyelenggara pelindungan data
            pribadi sesuai UU PDP.
          </LegalP>
        </>
      ),
    },
    {
      id: "anak",
      title: "Pengguna di bawah umur",
      content: (
        <LegalP>
          Layanan ini ditujukan untuk pengguna berusia minimal{" "}
          <LegalValue value={LEGAL_FACTS.minimumAge} />. Pengguna yang belum berusia 18 tahun
          tergolong anak menurut hukum Indonesia, dan sesuai UU PDP pemrosesan data pribadi anak
          memerlukan persetujuan orang tua atau wali. Karena itu pengguna berusia di bawah 18 tahun
          hanya boleh mendaftar dan memakai layanan dengan persetujuan orang tua atau wali. Bila
          Anda orang tua atau wali dan mengetahui anak Anda memakai layanan ini tanpa persetujuan,
          hubungi <ContactEmail /> agar akunnya dapat kami tindak lanjuti, termasuk dihapus.
        </LegalP>
      ),
    },
    {
      id: "perubahan",
      title: "Perubahan kebijakan",
      content: (
        <LegalP>
          Kami dapat memperbarui kebijakan ini saat cara aplikasi memproses data berubah. Versi dan
          tanggal pembaruan selalu tercantum di bagian atas halaman ini. Untuk perubahan yang
          berarti, kami akan berupaya memberi tahu lewat aplikasi atau email sebelum perubahan
          berlaku.
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
