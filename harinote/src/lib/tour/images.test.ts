import { describe, expect, it } from "vitest";
import { extractImageUrls } from "./images";

function wrap(items: unknown) {
  return {
    response: {
      header: { resultCode: "0000", resultMsg: "OK" },
      body: { items },
    },
  };
}

describe("extractImageUrls", () => {
  it("originimgurl 배열을 순서대로 반환", () => {
    const json = wrap({
      item: [
        { originimgurl: "http://a.com/1.jpg", smallimageurl: "http://a.com/1s.jpg" },
        { originimgurl: "http://a.com/2.jpg" },
      ],
    });
    expect(extractImageUrls(json)).toEqual([
      "http://a.com/1.jpg",
      "http://a.com/2.jpg",
    ]);
  });

  it("item이 단일 객체여도 배열로 처리", () => {
    const json = wrap({ item: { originimgurl: "http://a.com/1.jpg" } });
    expect(extractImageUrls(json)).toEqual(["http://a.com/1.jpg"]);
  });

  it("originimgurl 없으면 smallimageurl로 폴백", () => {
    const json = wrap({
      item: [{ smallimageurl: "http://a.com/small.jpg" }],
    });
    expect(extractImageUrls(json)).toEqual(["http://a.com/small.jpg"]);
  });

  it('결과 없음(items="")·형식 불일치는 빈 배열', () => {
    expect(extractImageUrls(wrap(""))).toEqual([]);
    expect(extractImageUrls({})).toEqual([]);
    expect(extractImageUrls(null)).toEqual([]);
    expect(extractImageUrls("oops")).toEqual([]);
  });

  it("중복 URL·비http URL은 제외", () => {
    const json = wrap({
      item: [
        { originimgurl: "http://a.com/1.jpg" },
        { originimgurl: "http://a.com/1.jpg" },
        { originimgurl: "ftp://a.com/2.jpg" },
        { originimgurl: "" },
      ],
    });
    expect(extractImageUrls(json)).toEqual(["http://a.com/1.jpg"]);
  });

  it("resultCode가 0000이 아니면 빈 배열", () => {
    const json = {
      response: {
        header: { resultCode: "03", resultMsg: "NODATA_ERROR" },
        body: { items: "" },
      },
    };
    expect(extractImageUrls(json)).toEqual([]);
  });
});
