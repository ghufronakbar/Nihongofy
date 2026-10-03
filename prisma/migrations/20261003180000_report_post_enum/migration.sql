-- Postingan komunitas sebagai target laporan, bagian 1: nilai enum saja.
--
-- Sengaja dipisah dari 20261003180100_post dengan alasan yang sama seperti
-- 20261002120000_report_bunpou_enum: PostgreSQL menolak memakai nilai enum yang
-- ditambahkan di transaksi yang sama (SQLSTATE 55P04), dan CHECK constraint di
-- migration berikutnya menyebut nilai ini.

ALTER TYPE "ReportTargetType" ADD VALUE 'POST';
