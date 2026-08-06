import { describe, it, expect } from "vitest";
import { parsePassage } from "./passage";

describe("parsePassage", () => {
  it("자료 형식 라벨은 제목으로 분리한다", () => {
    expect(parsePassage("[역사 신문] 조·명 연합군, 평양성 탈환")).toEqual({
      label: "역사 신문",
      body: "조·명 연합군, 평양성 탈환",
    });
  });

  it("[해설] 등 일반 라벨은 벗겨내고 본문만 남긴다", () => {
    expect(parsePassage("[해설] 경주 불국사에 있는 이 탑")).toEqual({
      label: null,
      body: "경주 불국사에 있는 이 탑",
    });
  });

  it("[자료]도 일반 라벨로 취급해 제거한다", () => {
    expect(parsePassage("[자료] 뉴스 앵커 삽화")).toEqual({ label: null, body: "뉴스 앵커 삽화" });
  });

  it("라벨이 없으면 그대로 둔다", () => {
    expect(parsePassage("이 성곽은 한성부 도심의 경계를 표시")).toEqual({
      label: null,
      body: "이 성곽은 한성부 도심의 경계를 표시",
    });
  });

  it("라벨만 있고 본문이 없으면 원문을 유지한다", () => {
    expect(parsePassage("[역사 신문]")).toEqual({ label: null, body: "[역사 신문]" });
  });

  it("공백/개행을 정리한다", () => {
    expect(parsePassage("  [대담]  질문과 답변  ")).toEqual({ label: "대담", body: "질문과 답변" });
  });

  it("문자열이 아니면 안전하게 빈 본문", () => {
    // @ts-expect-error 런타임 방어 확인
    expect(parsePassage(null)).toEqual({ label: null, body: "" });
  });
});
