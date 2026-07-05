import { describe, expect, it } from "vitest";
import {
  cleanNaverText,
  formatPostdate,
  toBlogReviews,
} from "./naver-blog";

describe("cleanNaverText", () => {
  it("검색어 강조 <b> 태그를 제거", () => {
    expect(cleanNaverText("<b>남이섬</b> 다녀왔어요")).toBe("남이섬 다녀왔어요");
  });

  it("HTML 엔티티를 해제", () => {
    expect(cleanNaverText("아이랑 &quot;물놀이&quot; &amp; 산책 &lt;3 &#39;강추&#39;")).toBe(
      "아이랑 \"물놀이\" & 산책 <3 '강추'",
    );
  });

  it("빈 문자열은 그대로", () => {
    expect(cleanNaverText("")).toBe("");
  });
});

describe("formatPostdate", () => {
  it("YYYYMMDD → YYYY.MM.DD", () => {
    expect(formatPostdate("20260701")).toBe("2026.07.01");
  });

  it("형식이 다르면 undefined", () => {
    expect(formatPostdate("2026-07-01")).toBeUndefined();
    expect(formatPostdate("")).toBeUndefined();
    expect(formatPostdate(undefined)).toBeUndefined();
  });
});

describe("toBlogReviews", () => {
  it("정상 응답을 BlogReview[]로 변환", () => {
    const json = {
      items: [
        {
          title: "<b>경포해변</b> 후기",
          link: "https://blog.naver.com/x/1",
          description: "정말 <b>좋았어요</b> &amp; 또 갈래요",
          bloggername: "여행자",
          postdate: "20260615",
        },
      ],
    };
    expect(toBlogReviews(json)).toEqual([
      {
        title: "경포해변 후기",
        link: "https://blog.naver.com/x/1",
        summary: "정말 좋았어요 & 또 갈래요",
        blogger: "여행자",
        postDate: "2026.06.15",
      },
    ]);
  });

  it("link나 title이 없는 항목은 제외", () => {
    const json = {
      items: [
        { title: "제목만", description: "d", bloggername: "b" },
        { link: "https://x.com", description: "d", bloggername: "b" },
      ],
    };
    expect(toBlogReviews(json)).toEqual([]);
  });

  it("형식 불일치는 빈 배열", () => {
    expect(toBlogReviews(null)).toEqual([]);
    expect(toBlogReviews({})).toEqual([]);
    expect(toBlogReviews({ items: "oops" })).toEqual([]);
  });
});
