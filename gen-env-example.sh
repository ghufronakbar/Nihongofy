#!/bin/bash

INPUT=".env"
OUTPUT=".env.example"

# Cek apakah file .env ada
if [ ! -f "$INPUT" ]; then
    echo "Error: File $INPUT tidak ditemukan!"
    exit 1
fi

> "$OUTPUT"

# Variable penanda (flag) apakah kita sedang berada di bawah #COMMON
keep_value=false

while IFS= read -r line || [ -n "$line" ]; do
    # Jika baris kosong, langsung cetak
    if [[ -z "$line" ]]; then
        echo "$line" >> "$OUTPUT"
        continue
    fi

    # Jika baris adalah komentar
    if [[ "$line" == \#* ]]; then
        # Jika komentarnya mengandung #COMMON, aktifkan mode keep_value
        if [[ "$line" == *"# COMMON"* ]]; then
            keep_value=true
        else
            # Jika komentar lain (misal #DATABASE), matikan mode keep_value
            keep_value=false
        fi
        echo "$line" >> "$OUTPUT"
        continue
    fi

    # Jika baris memiliki tanda sama dengan (=)
    if [[ "$line" == *"="* ]]; then
        if [ "$keep_value" = true ]; then
            # Pertahankan value jika sedang di dalam area #COMMON
            echo "$line" >> "$OUTPUT"
        else
            # Hapus value jika di luar #COMMON
            key="${line%%=*}"
            echo "${key}=" >> "$OUTPUT"
        fi
    else
        # Jika bukan komentar dan tidak ada '=', cetak apa adanya
        echo "$line" >> "$OUTPUT"
    fi
done < "$INPUT"

echo "Berhasil! $OUTPUT telah dibuat dengan mempertahankan value di section #COMMON."