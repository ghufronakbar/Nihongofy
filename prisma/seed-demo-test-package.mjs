import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_PACKAGE_NAME = "DEMO - Seed Testing";

async function main() {
  const existing = await prisma.testPackage.findFirst({
    where: { name: DEMO_PACKAGE_NAME },
    select: { id: true },
  });

  if (existing) {
    console.info(
      `[seed:demo-test-package] skipped, package sudah ada (id=${existing.id}).`,
    );
    return;
  }

  const testPackageId = await prisma.$transaction(async (tx) => {
    const testPackage = await tx.testPackage.create({
      data: { name: DEMO_PACKAGE_NAME, jlptLevel: "N5" },
      select: { id: true },
    });

    const dokkaiContext = await tx.questionContext.create({
      data: {
        testPackageId: testPackage.id,
        storyText:
          "わたしは まいにち 7じに おきます。あさごはんを たべてから、がっこうに いきます。" +
          "がっこうは いえから あるいて 15ふん です。じゅぎょうは 8じはんに はじまります。",
      },
      select: { id: true },
    });

    await tx.testPackageItem.create({
      data: {
        testPackageId: testPackage.id,
        mondaiType: "MOJI_GOI_READ_KANJI",
        section: "MOJI_GOI",
        session: 1,
        order: 1,
        instruction: "＿＿の言葉の読み方として最もよいものを、1・2・3・4から一つえらびなさい。",
        questions: {
          create: [
            {
              order: 1,
              questionText: "明日、__{学校|がっこう}__に 行きます。",
              questionAnswer: 1,
              explanation: "「学校」は「がっこう」と読みます。",
              questionChoices: {
                create: [
                  { codeAnswer: 1, answerText: "がっこう" },
                  { codeAnswer: 2, answerText: "がこう" },
                  { codeAnswer: 3, answerText: "がっこ" },
                  { codeAnswer: 4, answerText: "がいこう" },
                ],
              },
            },
            {
              order: 2,
              questionText: "この__{本|ほん}__は とても おもしろいです。",
              questionAnswer: 1,
              explanation: "「本」は「ほん」と読みます。",
              questionChoices: {
                create: [
                  { codeAnswer: 1, answerText: "ほん" },
                  { codeAnswer: 2, answerText: "もと" },
                  { codeAnswer: 3, answerText: "ぼん" },
                  { codeAnswer: 4, answerText: "ほう" },
                ],
              },
            },
          ],
        },
      },
    });

    await tx.testPackageItem.create({
      data: {
        testPackageId: testPackage.id,
        mondaiType: "MOJI_GOI_CONTEXT",
        section: "MOJI_GOI",
        session: 1,
        order: 2,
        instruction: "（　）に 何を 入れますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。",
        questions: {
          create: [
            {
              order: 1,
              questionText: "きのう、友達と こうえんで テニスを ＿＿＿。1じかん ぐらい あそびました。",
              questionAnswer: 1,
              explanation: "テニスを「しました」が正しいです。",
              questionChoices: {
                create: [
                  { codeAnswer: 1, answerText: "しました" },
                  { codeAnswer: 2, answerText: "たべました" },
                  { codeAnswer: 3, answerText: "のみました" },
                  { codeAnswer: 4, answerText: "かいました" },
                ],
              },
            },
            {
              order: 2,
              questionText: "この コーヒーは ＿＿＿ です。とても おいしいです。",
              questionAnswer: 1,
              explanation: "味を表す形容詞「あつい」が文脈に合います。",
              questionChoices: {
                create: [
                  { codeAnswer: 1, answerText: "あつい" },
                  { codeAnswer: 2, answerText: "さむい" },
                  { codeAnswer: 3, answerText: "ひろい" },
                  { codeAnswer: 4, answerText: "くらい" },
                ],
              },
            },
          ],
        },
      },
    });

    await tx.testPackageItem.create({
      data: {
        testPackageId: testPackage.id,
        mondaiType: "BUNPOU_GRAMMAR",
        section: "BUNPOU",
        session: 2,
        order: 1,
        instruction: "つぎの文の（　）に 入れるのに いちばん いい ものを、1・2・3・4から 一つ えらびなさい。",
        questions: {
          create: [
            {
              order: 1,
              questionText: "わたしは まいあさ 6じ＿＿＿ おきます。",
              questionAnswer: 1,
              explanation: "時刻には助詞「に」を使います。",
              questionChoices: {
                create: [
                  { codeAnswer: 1, answerText: "に" },
                  { codeAnswer: 2, answerText: "を" },
                  { codeAnswer: 3, answerText: "が" },
                  { codeAnswer: 4, answerText: "で" },
                ],
              },
            },
            {
              order: 2,
              questionText: "きょうしつ＿＿＿ 学生が 五人 います。",
              questionAnswer: 1,
              explanation: "存在の場所には助詞「に」を使います。",
              questionChoices: {
                create: [
                  { codeAnswer: 1, answerText: "に" },
                  { codeAnswer: 2, answerText: "へ" },
                  { codeAnswer: 3, answerText: "と" },
                  { codeAnswer: 4, answerText: "から" },
                ],
              },
            },
          ],
        },
      },
    });

    await tx.testPackageItem.create({
      data: {
        testPackageId: testPackage.id,
        mondaiType: "DOKKAI_SHORT_TEXT",
        section: "DOKKAI",
        session: 2,
        order: 2,
        instruction: "つぎの文章を読んで、質問に答えてください。",
        questions: {
          create: [
            {
              order: 1,
              questionText: "「わたし」は 何時に おきますか。",
              questionAnswer: 1,
              explanation: "文章の最初に「7じに おきます」とあります。",
              questionContextId: dokkaiContext.id,
              questionChoices: {
                create: [
                  { codeAnswer: 1, answerText: "7じ" },
                  { codeAnswer: 2, answerText: "8じ" },
                  { codeAnswer: 3, answerText: "8じはん" },
                  { codeAnswer: 4, answerText: "15ふん" },
                ],
              },
            },
            {
              order: 2,
              questionText: "がっこうまで どうやって いきますか。",
              questionAnswer: 1,
              explanation: "「あるいて 15ふん」とあるので、歩いて行きます。",
              questionContextId: dokkaiContext.id,
              questionChoices: {
                create: [
                  { codeAnswer: 1, answerText: "あるいて いきます" },
                  { codeAnswer: 2, answerText: "バスで いきます" },
                  { codeAnswer: 3, answerText: "でんしゃで いきます" },
                  { codeAnswer: 4, answerText: "くるまで いきます" },
                ],
              },
            },
          ],
        },
      },
    });

    return testPackage.id;
  });

  console.info(`[seed:demo-test-package] seeded (id=${testPackageId}).`);
}

main()
  .catch((error) => {
    console.error("[seed:demo-test-package] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
