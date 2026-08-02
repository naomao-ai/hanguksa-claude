import cv2
import numpy as np
import glob
import os

def audit_images():
    # 경로 패턴 설정 (모든 회차의 crops 폴더 아래 png 파일)
    pattern = os.path.join('_import', '*', 'crops', '*.png')
    files = glob.glob(pattern)
    
    if not files:
        print("검사할 이미지를 찾을 수 없습니다.")
        return

    results = []
    
    for file_path in sorted(files):
        try:
            # OpenCV로 이미지를 그레이스케일로 로드
            img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
                
            h, w = img.shape
            
            # 이진화 처리 (배경은 흰색, 글자/그림은 검은색일 가능성이 높으므로)
            # Thresholding을 통해 잉크가 있는 곳을 찾음 (임계값 240 기준으로 어두운 영역 추출)
            _, thresh = cv2.threshold(img, 240, 255, cv2.THRESH_BINARY_INV)
            
            # 잉크가 있는 모든 픽셀의 좌표를 찾음
            coords = cv2.findNonZero(thresh)
            
            if coords is not None:
                x, y, w_box, h_box = cv2.boundingRect(coords)
                
                issues = []
                # Check 1: Cut-off 감지 (위아래 여백이 2픽셀 이하인 경우)
                if y <= 2:
                    issues.append("상단 잘림 의심(Top Cut-off)")
                if (y + h_box) >= h - 2:
                    issues.append("하단 잘림 의심(Bottom Cut-off)")
                if x <= 2:
                    issues.append("좌측 잘림 의심(Left Cut-off)")
                if (x + w_box) >= w - 2:
                    issues.append("우측 잘림 의심(Right Cut-off)")
                
                # Check 2: 과다 여백 감지 (빈 공간이 이미지 크기 대비 과도한 경우)
                # 상하/좌우 여백 비율 계산
                top_margin_ratio = y / h
                bottom_margin_ratio = (h - (y + h_box)) / h
                left_margin_ratio = x / w
                right_margin_ratio = (w - (x + w_box)) / w
                
                margin_issues = []
                if top_margin_ratio > 0.15: margin_issues.append("상단")
                if bottom_margin_ratio > 0.15: margin_issues.append("하단")
                if left_margin_ratio > 0.15: margin_issues.append("좌측")
                if right_margin_ratio > 0.15: margin_issues.append("우측")
                
                if margin_issues:
                    # 상하 또는 좌우 양쪽 모두 15% 이상 여백인 경우 과다 여백으로 판정
                    if ("상단" in margin_issues and "하단" in margin_issues) or \
                       ("좌측" in margin_issues and "우측" in margin_issues) or \
                       len(margin_issues) >= 2:
                        issues.append(f"과다 여백 의심({', '.join(margin_issues)} 여백 과다)")

                if issues:
                    round_name = os.path.basename(os.path.dirname(os.path.dirname(file_path)))
                    file_name = os.path.basename(file_path)
                    results.append({
                        "round": round_name,
                        "file": file_name,
                        "issues": issues,
                        "size": f"{w}x{h}",
                        "ink_box": f"x:{x}, y:{y}, w:{w_box}, h:{h_box}"
                    })
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    # 리포트 마크다운 포맷 생성
    report_lines = [
        "# 로컬 이미지 전수 검사 결과 (OpenCV 기반)",
        "",
        f"- 총 검사 대상 이미지 수: **{len(files)}장**",
        f"- 이상 감지 이미지 수: **{len(results)}장**",
        "",
        "## 상세 이상 항목 리스트",
        ""
    ]
    
    if results:
        report_lines.append("| 회차 | 파일명 | 감지된 결함 (Issues) | 전체 크기 | 잉크 영역 |")
        report_lines.append("|---|---|---|---|---|")
        for res in results:
            issues_str = "<br>".join(res["issues"])
            report_lines.append(f"| {res['round']} | {res['file']} | {issues_str} | {res['size']} | {res['ink_box']} |")
    else:
        report_lines.append("🎉 검출된 결함이 없습니다. (모든 이미지가 양호함)")

    report_content = "\n".join(report_lines)
    
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "local_image_audit_results.md")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_content)
        
    print(f"검사가 완료되었습니다. 결과가 저장된 경로: {output_path}")

if __name__ == "__main__":
    audit_images()
