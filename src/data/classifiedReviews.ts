/**
 * Generated Classified Reviews and Product Statistics
 * Based on honestflower_weekly_classified.csv and honestflower_product_stats.csv
 */

export interface Review {
  id: number;
  date: string;
  product: string;
  rating: number;
  type: "추천" | "중립" | "비추천";
  category: string;
  department: string;
  review: string;
  archived?: boolean;
  reviewer?: string;
  image_url?: string;
  rawReviewer?: string;
  image_urls?: string[];
}

export interface ProductStat {
  product: string;
  totalCount: number;
  avgRating: number;
  recommend: number;
  neutral: number;
  notRecommend: number;
  recommendRate: number;
}

export const reviewsData: Review[] = [
  {
    "id": 1,
    "date": "2026.06.25",
    "product": "테디베어 해바라기",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "예상대로네요"
  },
  {
    "id": 2,
    "date": "2026.06.25",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "풍성하네요"
  },
  {
    "id": 3,
    "date": "2026.06.25",
    "product": "(한정) 해바라기 에이드 믹스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "카페느낌"
  },
  {
    "id": 4,
    "date": "2026.06.25",
    "product": "플로픽 파스텔",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "보들보들하게 화사한 꽃이 집안 분위기를 예쁘게 바꿔주네요"
  },
  {
    "id": 5,
    "date": "2026.06.25",
    "product": "엔카이셔스+화병 세트",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "예쁘고 상태도 아주 좋습니다."
  },
  {
    "id": 6,
    "date": "2026.06.25",
    "product": "알스트로메리아 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "처음시켜봤는데  만족합니다 !.  아기 백일상에 올릴려고 삿는데  비싼꽃집보다   훨 나아요!!!"
  },
  {
    "id": 7,
    "date": "2026.06.25",
    "product": "프릴 리시안셔스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "여러 번 구매했는데 한 번도 실망한 적이 없어요. 꽃이 항상 싱싱하고 예쁘게 와서 받을 때마다 기분이 좋아져요. 이래서 계속 재구매하게 되는 것 같아요. 다음에도 또 주문할게요!"
  },
  {
    "id": 8,
    "date": "2026.06.25",
    "product": "플로픽 내추럴",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "언제나 예뻐요."
  },
  {
    "id": 9,
    "date": "2026.06.25",
    "product": "샌더소니아",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "꽃이 여려보여서 배송이 잘 올까 걱정했는데 안전하고 예쁘게 잘 도착했습니다! 열어보면서도 너무 예뻐서 계속 감탄했던.. ㅠㅠ 어니스트플라워 덕분에 새로운 꽃 알아가는게 너무 좋아요"
  },
  {
    "id": 10,
    "date": "2026.06.25",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "예쁜데 생각보다 크네요 남편이 집이 식물원 같고 좋대요ㅋㅋ 오래 살았으면 좋겠어요😍"
  },
  {
    "id": 11,
    "date": "2026.06.25",
    "product": "퐁퐁 국화 외 2",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "신선하고 예뻐요"
  },
  {
    "id": 12,
    "date": "2026.06.25",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "주방 분위기가 확 좋아졌어요 안전하게 잘 왔고 수형도 예쁘고 풍성해서 맘에듭니다"
  },
  {
    "id": 13,
    "date": "2026.06.25",
    "product": "엔카이셔스+화병 세트",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "구성이 너무좋아요~집이 초록잎 하나로 분위기가 획 사는것 같아요~"
  },
  {
    "id": 14,
    "date": "2026.06.25",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "생각했던 것보다 훨씬 풍성합니다. 싱그럽운 여름 느낌이에요!!"
  },
  {
    "id": 15,
    "date": "2026.06.25",
    "product": "열매 수국",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "첫 구매인데 안전하고 빠르게 배송이 잘 왔고요. 받은 식물이 싱싱했어요 :) 6일째인데 아직도 푸릇푸릇 잘 살아있습니다! 예쁜 식물 보내주셔서 감사해요 다른 꽃도 구매하고 싶습니다 :)"
  },
  {
    "id": 16,
    "date": "2026.06.25",
    "product": "홍화",
    "rating": 4,
    "type": "중립",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "가격대비 풍성하고 싱싱해요. 첫구매한 해바라기는 꽂기가 어려워 기대보단 예쁘게 감상하지 못했지만 이번 꽃은 그냥 꽂기만 해도 이쁘네요."
  },
  {
    "id": 17,
    "date": "2026.06.25",
    "product": "열매 너도밤나무",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "아직은 녹색이 열매를 받았는데 갈색으로 변하는 모습도 볼 수 있으면 좋겠어요"
  },
  {
    "id": 18,
    "date": "2026.06.25",
    "product": "자리공",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "이번에 구매한 열매들이 다 예쁘네요. 특히 자리고 참 탐스럽습니다."
  },
  {
    "id": 19,
    "date": "2026.06.25",
    "product": "오리목",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "여름 열매로 오리 열매 멋지네요"
  },
  {
    "id": 20,
    "date": "2026.06.25",
    "product": "자리공",
    "rating": 1,
    "type": "비추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "무슨 홈페이지가 후기작성이 이렇게 복잡한지. 꽃은 7가지도 넘게 부러져 오고 핀토스는 드라이플라워처럼 다 말라가지고 왔어요. 이런 제품은 안보내는게 맞는 것 아닌가요? 쓰레기통으로 가야 할 제품을 보내시는건가요?"
  },
  {
    "id": 21,
    "date": "2026.06.25",
    "product": "열매 망개",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "그린 열매가 너무 예쁩니다"
  },
  {
    "id": 22,
    "date": "2026.06.25",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "아 그리면 구입 하는 걸 깜빡해서 일단 담을 수 있는 곳에 담아놨습니다. 아크릴 병에 담으면 정말 예쁠 것 같아요."
  },
  {
    "id": 23,
    "date": "2026.06.25",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃 상태도 좋았고 다 예뻐요. 맘에 듭니다."
  },
  {
    "id": 24,
    "date": "2026.06.25",
    "product": "작약",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "꼼꼼히 포장해주시고 꽃상태도 신선 너무 만족합니다 또 주문할께요^^"
  },
  {
    "id": 25,
    "date": "2026.06.25",
    "product": "레이스플라워 외 1",
    "rating": 3,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃은 이런 시즌엔 시키는게 아닌걸까요ㅠ ㅠ 레이스플라워는 거의 마르다시피해서 왔고 거베라도 그렇게 싱싱해보이는건 아닌듯합니다. 첫 구매인데 다음 구매할때도 망설여질것같아요"
  },
  {
    "id": 26,
    "date": "2026.06.25",
    "product": "레몬 해바라기",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "여름이라 걱정했는데 꽃이 신선하게 도착했어요!"
  },
  {
    "id": 27,
    "date": "2026.06.25",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "3년 연속 구매했는데 올해 가장 크고 풍성하네요. 오래 잘 감상하겠습니다"
  },
  {
    "id": 28,
    "date": "2026.06.25",
    "product": "엔카이셔스+화병 세트",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "허전하던 공간을 채워봤어요 식물 키울 자신이 없고 뭘 둬야할지도 막막했지만 세트가 있어서 맘먹고 처음으로 구매해보는 식물로 선택해봤습니다. 게다가 택배로 식물 받는다는거 자체가 걱정되기도 했었는데 매우 꼼꼼하고 안전하게 잘 왔더라고요 ! 모양도 사이즈도 이파리도 저는 모든 것에 매우만족합니다 오래오래 갔음 좋겠네용 ~!"
  },
  {
    "id": 29,
    "date": "2026.06.25",
    "product": "아마란서스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "날이 더워서 그런가ㅠ 둘 다 축쳐져서 배송됐는데 상처없이 배송되서 우선 물에 담가서 살아나길 바래봅니다🤣"
  },
  {
    "id": 30,
    "date": "2026.06.25",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "언제나 신선하고 금방가져온거같은 느낌 수형도 넘 맘에들고 작년에도 이맘때쯤 구입해서 오래동안 시원하고 싱그럽게 집안을 장식해서 올해도 또~여름은 엔카이셔스가 난 최고~^^"
  },
  {
    "id": 31,
    "date": "2026.06.25",
    "product": "엔카이셔스+화병 세트",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "집안 분위기가 살아요 너무 맘에 들어요 신선하게 잘도착했어요 꼼꼼한 포장덕입니다 단골할래요~~^ 주변에 적극 자랑겸 홍보중입니다"
  },
  {
    "id": 32,
    "date": "2026.06.25",
    "product": "절화수명연장제 외 1",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "꽃이 떨어져서 올까봐 걱정했는데 아주 좋은 컨디션으로 왔어요 :) 다른데서는 잘 팔지 않는 꽃이라 좋네요 예쁘고요 새벽배송이 확실히 꽃상태가 더 좋은 것 같아요"
  },
  {
    "id": 33,
    "date": "2026.06.25",
    "product": "글라디올러스 외 3",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "감사합니다"
  },
  {
    "id": 34,
    "date": "2026.06.25",
    "product": "금꿩의 다리",
    "rating": 4,
    "type": "중립",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "금꿩의다리 꽃 너무 좋아해서 주문했어요♤♤"
  },
  {
    "id": 35,
    "date": "2026.06.25",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "부모님댁에 꾸준히 보내드리고 있어요. 신선하고 품질 좋은 꽃을 매달 받아보시니 집안에 생기가 돈다고 좋아하세요. 럭키박스여서 매달 어떤 꽃이 오는지 기대된다고 하시네요. 적당한 가격대로 여러가지 재미가 있네요. 굿굿."
  },
  {
    "id": 36,
    "date": "2026.06.25",
    "product": "페니쿰 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "선물했는데 엄청 좋아하셨어요 ㅎㅎ"
  },
  {
    "id": 37,
    "date": "2026.06.25",
    "product": "플로픽 비비드",
    "rating": 3,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "첫번째 배송에서 수국이 완전 시들어와서 재배송 받았는데 수국은 괜찮은데 다른 꽃이 또 시들어왔어요 여름이라 그럴까요? 재요청해봐야 또 그럴것같아 그냥 받기로 했습니다 여름이라는 계절적 특성이 있어서 꽃이 싱싱하지 못하다면 여름에 강한 제품들로 구성헤야 하지 않을까 합니다 그래서 여름시즌은 구독을 중지헤야 겠어요"
  },
  {
    "id": 38,
    "date": "2026.06.25",
    "product": "열매 수국 외 1",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "다양한 해바라기믹스 를 받아서 너무 예쁘고 좋아요 다만 테디베어해바라기 한송이가 상태가 않좋아요.ㅠㅠ"
  },
  {
    "id": 39,
    "date": "2026.06.25",
    "product": "밀레니얼 핑크 장미",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무 예뻐요 ~꽃이 싱싱하고 찬미가 엄청 커요~질 받았습니다 ~"
  },
  {
    "id": 40,
    "date": "2026.06.25",
    "product": "미스티블루",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "아주 마음에 들어요. 잔잔한 꽃이 예쁘고 식탁에 풍성한 느낌이 좋아요."
  },
  {
    "id": 41,
    "date": "2026.06.25",
    "product": "무늬 레몬트리 외 2",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "완전 여름느낌 이뻐요"
  },
  {
    "id": 42,
    "date": "2026.06.25",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "엔카이셔스 언제나 로망이었는데 생각보다 비싸서 망설이게 됐었는데 이런 저렴한 가격에 3개를 구매해서 집안에 두니 부자가 된 느낌입니다 ㅎㅎ싱싱하고 잘 포장돼서 왔어요. 추천합니다^^"
  },
  {
    "id": 43,
    "date": "2026.06.25",
    "product": "덴파레",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "오래볼 수 있어서 덴파레 구입했어요."
  },
  {
    "id": 44,
    "date": "2026.06.25",
    "product": "자이언트 델피늄",
    "rating": 1,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "델피늄이 원래 꽃잎이 잘 떨어지는 꽃인 점을 감안하더라도 줄기 하나에 달린 꽃이 거의 다 떨어진 건 컨디션이 너무 안 좋은 것 같습니다. 잘 붙은 두 줄기만 보내주셔도 좋았을텐데 뭔가 떨이로 처리해야하는 쓰레기를 받은 것 같아 속상하네요."
  },
  {
    "id": 45,
    "date": "2026.06.24",
    "product": "플라워 럭키박스",
    "rating": 2,
    "type": "비추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "꽃으로 생기를 충전하고 싶었는데 꽃 상태가 안 좋아서 좀 실망했어요. 몬디알 장미는 세 송이 왔는데 꽃잎이 다 시들어서 몇장 떼내다가 다 버렸어요. 리시안셔스도 꽃 상태가 흐물흐물하고 수국잎도 부분적으로 시들어서 왔어요. 홍화는 잎부분이랑 꽃이 바짝 말라 온 게 많고요. ㅠㅠ 이번 주는 선선했는데도 상태가 이러면 여름에 주문하는 건 제고해 봐야겠어요."
  },
  {
    "id": 46,
    "date": "2026.06.24",
    "product": "플로픽 파스텔",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무이뻐요"
  },
  {
    "id": 47,
    "date": "2026.06.24",
    "product": "피콜리니 거베라",
    "rating": 4,
    "type": "중립",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "새벽배송으로 잘 받았는데 조금 일찍 시드는 것 같아요. 분명 물도 갈아주고 수위도 잘 맞춰줬는데 ㅠㅠ 조금 아쉬워요."
  },
  {
    "id": 48,
    "date": "2026.06.24",
    "product": "초코 해바라기 외 3",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "홈페이지 사진보단 좀 더 노랑색이 있는 꽃이 왔어요. 얼굴이 조금 숙이고 있지만 이거대로 자연스럽고 큰 화기에 덩어리 있게 꽂으니 너무 예뻐요."
  },
  {
    "id": 49,
    "date": "2026.06.24",
    "product": "자이언트 델피늄 외 1",
    "rating": 3,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "배송은 잘 왔는데 뭔가 너무 많이 펴서 온 것 같아요"
  },
  {
    "id": 50,
    "date": "2026.06.24",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "해바라기는 같이 주문한 자리공과 달리 상태가 괜찮네요"
  },
  {
    "id": 51,
    "date": "2026.06.24",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃 잘 받았습니다. 매주 새로운꽃이 배달되는 정기구독 중입니다. 만족도가 높아요 꾸준히 받아 볼 생각입니다."
  },
  {
    "id": 52,
    "date": "2026.06.24",
    "product": "자리공",
    "rating": 1,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "멀쩡한 가지가 하나없이 더 꺾여왔는데 이럴거면 품목에 넣지 마세요"
  },
  {
    "id": 53,
    "date": "2026.06.24",
    "product": "테디베어 해바라기 외 1",
    "rating": 3,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무 시들어 왔어요"
  },
  {
    "id": 54,
    "date": "2026.06.24",
    "product": "글라디올러스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "살짝 고개를 숙인 꽃들도 있었지만 생각보다 더 컬러가 예쁘고 포인트로 좋아요!"
  },
  {
    "id": 55,
    "date": "2026.06.24",
    "product": "플라워 럭키박스",
    "rating": 4,
    "type": "중립",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "날이 더워서인지 꽃들이 다 힘이 없이 시들시들해요. 내일 가 봐야 하겠지만 너무 시들어 왔어요 ㅠㅠ 지난 번에는 배달 사고까지 나고.. 매번 느끼는 거지만 그런 것 빼고는 좋아요. 전 특히 꽃카드가 너무 마음에 들어요^^"
  },
  {
    "id": 56,
    "date": "2026.06.24",
    "product": "거베라 마카롱 믹스",
    "rating": 2,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "해바라기도 엄청 고개 숙이고 있어서 일주일을 버렸는데 거베라 역시 고개를 숙인 걸 보내줬네요. 저한테만 일부러 그러시는 건 아닌지 속상하네요ㅡㅡ"
  },
  {
    "id": 57,
    "date": "2026.06.24",
    "product": "아스크레피아스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "아스크레피아스와 해바라기 믹스가 정말 잘 어울려요 🌼"
  },
  {
    "id": 58,
    "date": "2026.06.24",
    "product": "스프레이 델피늄 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "델피늄은 잎이 많이 떨어지는걸 감수할만큼 예뻐요 메인꽃 외에 돋보이게해주는 용으로 추천합니다 ㅎㅎ"
  },
  {
    "id": 59,
    "date": "2026.06.24",
    "product": "트롤리우스",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "우리 강아지 추모공간 꾸미려고 주문해봤는데 인터넷이라 기대안했는데 신선하고 예쁩니다"
  },
  {
    "id": 60,
    "date": "2026.06.24",
    "product": "해바라기",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "처음에 너무 안핀게와서 안이뻣어요 몇칠만에 이쁘게 폈네요 집에있는 꽃병이너무커서 같이시켰는데 꽃병은 좀 작아서 불안해요 큰집아니고. 오피스텔 작은식탁에 딱 가격만큼에 꽃병입니다"
  },
  {
    "id": 61,
    "date": "2026.06.24",
    "product": "썸머라일락 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "테디베어 해바라기와 썸머라일락이 거실 공간과 잘 어울립니. 예쁘네요."
  },
  {
    "id": 62,
    "date": "2026.06.24",
    "product": "플라워 럭키박스",
    "rating": 3,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "가지가 꺾인 게 많아서 연출이 쉽지가 않네요."
  },
  {
    "id": 63,
    "date": "2026.06.24",
    "product": "신지매",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "레몬 해바라기와 잘 어울릴것 같아서 함께 구입했는데 두가지만으로도 상큼 화사 합니다. 청량하고요. 싱싱한 제품이 와서 아직 꽃이 막 피진 않았지만 그대로도 넘 예쁩니다."
  },
  {
    "id": 64,
    "date": "2026.06.24",
    "product": "레몬 해바라기",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "기존의 뻔한 해바라기가 아니라서 너무 좋았고 싱싱한 상태로 와서 만족스럽습니다"
  },
  {
    "id": 65,
    "date": "2026.06.24",
    "product": "플로픽 비비드",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "싱싱하고 너무 예쁜 꽃이 왔네요~~ 요즘 계절에 딱 어울리는 블루컬러~~~너무 마음에 들어요!! 덕분에 기분좋은 하루 시작합니다:)"
  },
  {
    "id": 66,
    "date": "2026.06.24",
    "product": "페니쿰 외 3",
    "rating": 4,
    "type": "중립",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "예뻐요 꽃이 신선했습니다"
  },
  {
    "id": 67,
    "date": "2026.06.24",
    "product": "초코 코스모스",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "초코코스모스 너무 귀여워서 꼭 사고싶었는데 어니스트플라워에서 편하게 배송받을 수 있어서 좋아요 ~ 물올림이 잘 안되는지 고개가 쳐져있지만 그래도 귀여워요 !"
  },
  {
    "id": 68,
    "date": "2026.06.23",
    "product": "플라워 럭키박스",
    "rating": 4,
    "type": "중립",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "예쁜꽃 잘 받았어요 색의 조합이 은은해서 참 좋아요"
  },
  {
    "id": 69,
    "date": "2026.06.23",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "기다리던 엔카이셔스가 왔습니다! 중간에 이슈가 있었지만 어니스트에서 좋은 품질의 나무를 준비하고 있다는 말이 진심으로 와닿아 기다리는 시간도 즐거웠어요^^ 역시나 예쁜 아이가 도착했구요"
  },
  {
    "id": 70,
    "date": "2026.06.23",
    "product": "페니쿰 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "화병에 대충 꽂아두기만 해도 예쁘네요"
  },
  {
    "id": 71,
    "date": "2026.06.23",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "꽃 첫구매인데 너무 싱싱하고 예쁘고 다양한 꽃이와서 좋네요! 기대이상입니다ㅎㅎ👍👍 꽃보고 힐링합니다🥰"
  },
  {
    "id": 72,
    "date": "2026.06.23",
    "product": "비스위트 장미",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "진한 코랄빛을 띄는 꽃송이가 큰 장미예요. 물올림하고 나니 더 고급스럽고 예뻐졌어요. 5송이만으로도 풍성한 느낌이네요."
  },
  {
    "id": 73,
    "date": "2026.06.23",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 1,
    "type": "비추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "생일맞은 친구에게 보내려고 주문한건데"
  },
  {
    "id": 74,
    "date": "2026.06.23",
    "product": "플로픽 파스텔",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃들의 색상이 너무나 잘 어우러지고 온그대로 화병에 꽂기만 하면 되니 아주 편하고 예뻐요 싱싱해서 더 기분이 좋아요"
  },
  {
    "id": 75,
    "date": "2026.06.23",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "상품의 품질이 우수하며 예뻥요"
  },
  {
    "id": 76,
    "date": "2026.06.23",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "우여곡절끝에 잘받앟고 문제발생에 신속히 대처해주셔서 예쁜 해바라기 믹스를 즐기고있어요.고급집니다"
  },
  {
    "id": 77,
    "date": "2026.06.23",
    "product": "보리사초",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "좋아하는 보리사초 입니다. 싱그럽고 오래가고"
  },
  {
    "id": 78,
    "date": "2026.06.23",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃 이 5종이나 왔네요 색도 조화롭고 싱싱해요 👍👍"
  },
  {
    "id": 79,
    "date": "2026.06.23",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "테디베어2송이 일반해바라기 2송이 레몬 해바라기 1송이왓어요. 테디베어는 벌써 시들시들해요 나머지 해바라기는 괘찮습니다 예뻐요!"
  },
  {
    "id": 80,
    "date": "2026.06.23",
    "product": "열매 수국",
    "rating": 3,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "새벽 배송으로 받을걸 그랬나요?! 여름날이라 고생스러웠는지 상태가 안좋아요..."
  },
  {
    "id": 81,
    "date": "2026.06.23",
    "product": "열매 수국 외 1",
    "rating": 1,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "아무리 날씨를 감안해도 이건 너무하고요 줄기 다 휘고 꽃잎 마르고 떨어지고 이런 컨디션의 꽃을 판매한다는 생각을 하는 어니스트 플라워 실망입니다. 몇년간 중 최악이예요"
  },
  {
    "id": 82,
    "date": "2026.06.23",
    "product": "일본 조팝나무",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무 싱싱한 꽃이 왔어요. 싱그럽고 풍성합니다~^^"
  },
  {
    "id": 83,
    "date": "2026.06.23",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 1,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "날이 더워서 그런지..썩고..(날파리도 같이옴) 꽃잎도 다 떨어져서 왔어요"
  },
  {
    "id": 84,
    "date": "2026.06.23",
    "product": "알스트로메리아",
    "rating": 3,
    "type": "비추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "음....반다발이라도 이 꽃은 좀 더 풍성했었는데 이번 애들은 빈약하네요. 많이 아쉬웠어요."
  },
  {
    "id": 85,
    "date": "2026.06.23",
    "product": "트롤리우스",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "두가지 종류를 묶어서 그런지 꽃 하나가 부러지고 반정도 눌려 찌그러져 있었어요. 그렇지만 꽃꽂이 하고나니 남은 애들로도 충분히 예뻐요. 자연스럽게 늘어지는 모습도 예쁘고 낵도 예쁜 주황이라 집이 화사해지네요"
  },
  {
    "id": 86,
    "date": "2026.06.23",
    "product": "비스위트 장미",
    "rating": 4,
    "type": "중립",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "아"
  },
  {
    "id": 87,
    "date": "2026.06.23",
    "product": "절화수명연장제 외 2",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "집에있던 꽃과 같이 섞어 꽃아보았어요♡"
  },
  {
    "id": 88,
    "date": "2026.06.23",
    "product": "제네시스 믹스_06A",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "예뿌당 히히히"
  },
  {
    "id": 89,
    "date": "2026.06.23",
    "product": "열매 수국",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "시든 것으로 받아서 재배송받았어요. 집에서 작업하는 시간이 많아 초록이 보고싶어 구매했는데 재배송된 열매수국은 싱싱하네요. 예뻐요."
  },
  {
    "id": 90,
    "date": "2026.06.23",
    "product": "해바라기 외 2",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "여름이 오니까 쨍한 색들이 그리워서 구매해봤어요. 세가지 다 잘 어우러져서 만족합니다. 항상 꽃 양이 좀 적다는 느낌이 있었는데 해바라기가 얼굴이 크고 대가 튼튼해서 부피감이 확 사네요. 트롤리우스도 풍성한 느낌입니다. 무늬 레몬트리 상태가 좀 아쉽기는 해요. 잎에 군데군데 벌레먹은 자국들이라거나"
  },
  {
    "id": 91,
    "date": "2026.06.23",
    "product": "절화수명연장제",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "판매 안하는줄 알았는데 판매중이라 꽃 주문하면서 샀습니다^^"
  },
  {
    "id": 92,
    "date": "2026.06.23",
    "product": "초코 해바라기",
    "rating": 4,
    "type": "중립",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "사진과는 다르네요. 까만해바라기일줄 알았는데 좀 아쉬요~"
  },
  {
    "id": 93,
    "date": "2026.06.23",
    "product": "플로픽 비비드",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "수국이 한쪽으로 눌렸는데 다시 자리를 잡을려고 하니 혹시나 꺾일까봐 불안해서 못하겠네요 ㅎㅎ 그래도 꽃 품질은 너무 좋고 예쁩니다"
  },
  {
    "id": 94,
    "date": "2026.06.23",
    "product": "오드랑트 장미 외 2",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "이번주도 너무 이쁜꽃들도 행복한 일주일 보내고 있답니다!!! ㅎㅎ 항상 이쁘고 신선한 꽃 보내주셔서 감사드려요♥️"
  },
  {
    "id": 95,
    "date": "2026.06.23",
    "product": "플로픽 파스텔",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "배송문제로 연락드렸는데 신속하게 처리해주시고 원하는 날짜에 새벽배송으로 꽃신선하게 잘 받았다고 가족에게연락이왔네요 아침에꽃받으니기분좋다고 감사해요♡😊"
  },
  {
    "id": 96,
    "date": "2026.06.23",
    "product": "프릴 리시안셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "잘받았습니다. 오래갔으면 좋겠네요. :)"
  },
  {
    "id": 97,
    "date": "2026.06.23",
    "product": "아스틸베",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃의 ㄱ 자도 모릅니다.. 그냥 안주인분께서 요즘 잦은 야근과 육아에 지쳐있어보여서"
  },
  {
    "id": 98,
    "date": "2026.06.23",
    "product": "(한정) 해바라기 에이드 믹스 외 8",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "풍성한 여름 느낌 꽃다발 만들어서 지인 선물해줬어요. 만들면서도 기분이 좋았지만 받는 사람이 기뻐하니 더 기분이 좋았네요."
  },
  {
    "id": 99,
    "date": "2026.06.22",
    "product": "드럼스틱",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "줄기가 탄탄하고 봉우리가 이뻐요."
  },
  {
    "id": 100,
    "date": "2026.06.22",
    "product": "자리공",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "자리공 자체는 내추럴 하고 이쁜데 생각보다는 양이 적었어요"
  },
  {
    "id": 101,
    "date": "2026.06.22",
    "product": "아마란서스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "바다포도같이 풍성하고 이뻐요"
  },
  {
    "id": 102,
    "date": "2026.06.22",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "3번째 받아보는 꽃입니다 ⚘️ 너무 마음에 들어요! 집분위기 너무좋아지고 향기도 가득해져요"
  },
  {
    "id": 103,
    "date": "2026.06.22",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "4종류의 해바라기가 고루 와서 좋았어요. 다만 테디베어 해바라기는 약간 탈모(?)상태인거 같아서 조금 덜 예쁘긴 하네요. 그래도 쨍한 해바라기 덕분에 집이 밝아졌습니다."
  },
  {
    "id": 104,
    "date": "2026.06.22",
    "product": "쁘띠 수국 외 3",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "포인트로 주기좋아요 생각보다 금방 시들어서 아쉽지만요"
  },
  {
    "id": 105,
    "date": "2026.06.22",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "해바라기가 신선한 애들은 신선한데.. (아닌 애들은 또 너무 아니네요ㅜ) 그래도 이쁩니다💛"
  },
  {
    "id": 106,
    "date": "2026.06.22",
    "product": "루스커스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "오래가는 루카서스 어떤꽃과도 잘어울리고 풍성해져서 좋아요"
  },
  {
    "id": 107,
    "date": "2026.07.01",
    "product": "플라워 럭키박스",
    "rating": 3,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "오픈하는데 잎이 우수우 떨어지네요 그건 뭐 어쩔수 없다하더라도... 홈페이지 홍보 사진과 풍성함이 다른것 같아요 한번더 받아보고 또 실망감이 든다면 재주문은 안할것 같아요"
  },
  {
    "id": 108,
    "date": "2026.06.22",
    "product": "알스트로메리아",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "노란꽃이 풍성하고 예쁘네요 오래 보구 싶어요"
  },
  {
    "id": 109,
    "date": "2026.07.01",
    "product": "프릴 리시안셔스",
    "rating": 3,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃 들이 많이 떨어져 있어서 아쉬웠어요ㅠㅠ"
  },
  {
    "id": 110,
    "date": "2026.06.22",
    "product": "미니 거베라",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무 예뻐요 집에서 안전히 꽃을받아볼수있다니 너무편한세상이네요~"
  },
  {
    "id": 111,
    "date": "2026.06.22",
    "product": "수국 컬러믹스",
    "rating": 4,
    "type": "중립",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "첨엔 시들어왔는데 물먹고 탱탱해졌어요. 꽃송이가 풍성해요."
  },
  {
    "id": 112,
    "date": "2026.06.22",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 3,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "4종류 받았고 3종은 상태 괜찮았습니다 한종은 봉우리꽃을 받았습니다 종류도 4종이상으로 와서 좋았는데 테디베어(2대)가 싱싱하지 않습니다. 택배배송이라 그런거 같기도 해요 잎이 많이 떨어지고 가장자리 꽃잎이 떨어지고 말랐습니다 싱싱하지 않습니다. 그리고 줄기가 구부러져 있어요 참고하세요. 박스를 열었을 때 실망을 했는데 물꽂이 해두니 살아나서 예뻐졌어요"
  },
  {
    "id": 113,
    "date": "2026.06.22",
    "product": "쉼머 장미 외 2",
    "rating": 4,
    "type": "중립",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "할인해서 사긴 했지만 지난번에도 그렇고 장미들이 다 너무 핀채로 와서 관상기간이 너무 짧네요. 아쉽습니다. 하루 니나니 슬슬 고개를 숙이더라고요. 이번 꽃들도 너무 활짝 피어 왔네요. ㅠㅠ"
  },
  {
    "id": 114,
    "date": "2026.06.22",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "주방에서 설거지 하며 볼때마다 기분이 좋아요~~~~"
  },
  {
    "id": 115,
    "date": "2026.06.22",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "예뻐요 꽃도싱싱하고 풍성하게 보내주셔서 화병두개에 다른느낌으로 꽂아보았어요"
  },
  {
    "id": 116,
    "date": "2026.06.22",
    "product": "라벤더 잎",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "라벤더잎을 구매하며 요청한 날짜에 원하던 새벽시간에 정확히 올까? 걱정되어졌어요 (정해진 날짜의 힐링원예 프로그램에 사용 하려 주문) 요청한 새벽에 정확히 도착하였고"
  },
  {
    "id": 117,
    "date": "2026.06.21",
    "product": "아마란서스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "아마란서스는 포인트라인 잡기 너무 좋은 거같아요. 난꽃이랑 흐르듯 떨어지게 꽂았는데 너무 이뻐요. 그리고 4일정도 지나니 잎만 좀 시들고 잎 떼주니 꽤 오래 볼 수 있을 듯 해요"
  },
  {
    "id": 118,
    "date": "2026.06.21",
    "product": "파스타 거베라",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "물올림 했더니 하루 지나고 예쁘네요"
  },
  {
    "id": 119,
    "date": "2026.06.21",
    "product": "열매 수국 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "열매수국은 키가 상당히 커서 존재감 있네요 열매가 많이 떨어져와서 아쉬웠지만 해바라기랑 잘어울려요"
  },
  {
    "id": 120,
    "date": "2026.06.21",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "새로산 꽃병과 어울리는 꽃들을 보내주셨네요"
  },
  {
    "id": 121,
    "date": "2026.06.21",
    "product": "(한정) 해바라기 에이드 믹스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "처음 주문해봤는데 포장을 생각했던 것보다 더 꼼꼼하게 해주신 것같아요!! 문앞에 까지 배송이 오니 굳이 꽃시장 갈 필요도 없고 집에 꽃 꽂아두고 싶을때면 여기서 주문하면 되겠어요!"
  },
  {
    "id": 122,
    "date": "2026.06.21",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃이 이뻐서 가족들이 좋아하네요"
  },
  {
    "id": 123,
    "date": "2026.06.20",
    "product": "플로픽 비비드",
    "rating": 3,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "할인가격에 잘삿어요 약간 시든것 같긴해여"
  },
  {
    "id": 124,
    "date": "2026.06.20",
    "product": "오이초 외 8",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "이번 어니스트 새벽배송 최고!!!!!!!!"
  },
  {
    "id": 125,
    "date": "2026.06.20",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃이 너무 신선하구 안다치게 잘 도착하였습니다!!!! 넘 예뻐요 ❤️‍🔥❤️‍🔥❤️‍🔥"
  },
  {
    "id": 126,
    "date": "2026.06.20",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "아예 초록풀?잎 인것 말고 초록색 꽃은 아직도 생소하고 어렵긴하지만 이번껀 꽂아보니 괜찮은거같아요! 손재주가 있는편은 아니라 예쁘게 잘 두는게 어렵지만 서툰솜씨여도 옆에두면 분위기/기분전환되어 좋아요 날이조금 흐렸어서 그런지 그전보단 상태가 좋게 왔는데 장미봉오리 한두개 떨어지는거 말곤 괜찮아요 다 꽂아두고보니 괜찮은듯도 싶은데 흰색 위주로 있다보니 화사한 느낌은 좀 부족한가 싶어 아쉽기도하네요 그치만 매번 다음에 뭐가 올까 기대도되고 나름 만족스럽게 구독하고있어요!"
  },
  {
    "id": 127,
    "date": "2026.06.20",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "정기구독 중입니다. 일주일에 한번 꽃이 랜덤으로 와서 한주한주 꽃기다리는 재미를 느끼는중입니다."
  },
  {
    "id": 128,
    "date": "2026.06.20",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "잘 받았습니다. 계절에 잘 어울리는 꽃이에요! 한송이는 몽우리져서 안피면 어쩌나 걱정했는데 하루만에 활짝 펴서 신기했어요!"
  },
  {
    "id": 129,
    "date": "2026.06.20",
    "product": "쁘띠 수국 외 2",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "아버님 생신선물로도 똑같은 조합준비했어요~ 예쁘다고좋아하셨네요~!"
  },
  {
    "id": 130,
    "date": "2026.06.20",
    "product": "쁘띠 수국 외 2",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "여름느낌 물씬 예뻐요~ 자리공이 이렇게 대가 굵고 큰 식물인줄은 몰랐어요ㅎㅎ"
  },
  {
    "id": 131,
    "date": "2026.06.30",
    "product": "7월 플로리스트픽 내추럴",
    "rating": 3,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "3번째배송인데 지난번은 누락배송 이번엔 마지막사진처럼 꽃들을 고정하는장치로 고정하지않아 카네이션 머리가 부러져왔어요. 몇송이 안되는 꽃중 한놈이 망가져배송. ㅠ히야신스는 저렇게 짧뚱하게 보내와서 맨마지막 놈은 화병에 갇혀버리고...얼마전 해바라기도 시들어오더니 속상하네요. 아니 화가나요. 꽃구성은 첫번째사진처람 이뻐요. 그나마 대가리 부러진걸 대표사진으로안한건 예의사밉니다"
  },
  {
    "id": 132,
    "date": "2026.06.20",
    "product": "(한정) 장미 랜덤박스",
    "rating": 1,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "컨디션이 이게 뭡니꺼"
  },
  {
    "id": 133,
    "date": "2026.06.20",
    "product": "쁘띠 수국 외 2",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "이름답게 너무 귀여워요 좀 더 살걸 그랬다 싶어요"
  },
  {
    "id": 134,
    "date": "2026.06.20",
    "product": "자리공 외 2",
    "rating": 3,
    "type": "비추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "자리공은 괜찮았어요"
  },
  {
    "id": 135,
    "date": "2026.06.20",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "꽃이 싱싱합니다 해바라기도 종류가 많네요 큰해바라기는 징그러워서 싫었거등요 근데 믹스에포함된 해바라기들은 모두 귀여워요 5송이가 한묶음인데 두송이는 딸아이방에다 뒀네요 가끔 꽃이 필요할때 자주애용중인데 꽃설명이 최고로 맘에들고 화병도함께 구매할수있어서 또 좋아요 화초도 몇개판매하던데 좀 늘여주시면 좋겠어요ㅋ 꽃잘받아서 이뻐서 베리굿입니다"
  },
  {
    "id": 136,
    "date": "2026.06.20",
    "product": "(한정) 해바라기 에이드 믹스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "선물로 한거라 사진으로만 보긴했는데 크고 예쁘더라구요 포장도 깔끔하고 안내 카톡도 와서 선물하기에 좋은 것 같아요~!"
  },
  {
    "id": 137,
    "date": "2026.06.20",
    "product": "거베라 마카롱 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "안전하게 도착했어요 거실에 초록이만있어서 예쁜거베라로 포인트줬어요 한동안은 이쁘게 감상할수있어서 좋아요 거베라종류 모아놓으니 귀여워요 ㅋ"
  },
  {
    "id": 138,
    "date": "2026.06.20",
    "product": "모루 유리화기 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "이쁘게 화병꼿이 하였어요 ^^"
  },
  {
    "id": 139,
    "date": "2026.06.20",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "샌더 소니아 꽃이 너무 이쁘네요! 화병이 생각보다 커서 놀랬어요 근데 그 전에 꽃 상태들이 상태가 너무 좋았는데 이번에는 많아서 그런지 상태들이 좀 안좋네요 ㅜㅠ 그게 좀 속상했어요~ 화병과 같이 준다길래 럭키박스 구입해봤어요"
  },
  {
    "id": 140,
    "date": "2026.06.20",
    "product": "플라워 럭키박스",
    "rating": 3,
    "type": "비추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "장미가 2송이가 썩어있어서 버렸어요"
  },
  {
    "id": 141,
    "date": "2026.06.20",
    "product": "작약 외 6",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "만족해요"
  },
  {
    "id": 142,
    "date": "2026.06.20",
    "product": "초코 해바라기",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "실제로 받아보고 너무 작아서^^;;;;;;;; 잘못온거 아닌가 싶은데 그냥 꽂아두려구요ㅎㅎㅎ"
  },
  {
    "id": 143,
    "date": "2026.06.20",
    "product": "플로픽 내추럴 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "화병이 오브제 느낌나서 예뻐요 선물용으로 만족해요"
  },
  {
    "id": 144,
    "date": "2026.06.20",
    "product": "레이스플라워 외 1",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "거베라가 휘어져 왓네요"
  },
  {
    "id": 145,
    "date": "2026.06.20",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "해바라기 종류별로 볼 수 있어서 좋구 예뻐요"
  },
  {
    "id": 146,
    "date": "2026.06.20",
    "product": "실바써니 장미",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무 만족스럽네요. 풍성해요 힐링됩니다."
  },
  {
    "id": 147,
    "date": "2026.06.20",
    "product": "플로픽 비비드 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "수국 볼륨감 덕분에 꽃다발이 풍성한 느낌이였고 시원한 컬러가 공간을 청량한 분위기로 바꿔주네요ㅎ"
  },
  {
    "id": 148,
    "date": "2026.06.20",
    "product": "미니 거베라 외 1",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "오랜만에 어니스트에서 꽃 주문 했는데 싱싱하게 잘 왔어요^^ 배송이 잘 안 움직여 걱정 했는데 다행히 더운 날씨에 시들지 않게 왔네요~~"
  },
  {
    "id": 149,
    "date": "2026.06.20",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "날씨가 흐린데 해바라기 덕분에 집이 화사해졌어요"
  },
  {
    "id": 150,
    "date": "2026.06.20",
    "product": "절화수명연장제 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃이 좀 더 오래가길 바라며 꾸준히 넣어주고 있어요"
  },
  {
    "id": 151,
    "date": "2026.06.20",
    "product": "테디베어 해바라기 외 1",
    "rating": 4,
    "type": "중립",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무 눌려와서 조금아쉬요 그래도 해바라기로 여름만끽할수있어서 좋네요"
  },
  {
    "id": 152,
    "date": "2026.06.20",
    "product": "아스크레피아스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "해바라기 에이드 믹스에 흰색 아스크레피아스를 매칭했는데 오렌지가 아른거려서 결국 주문했어요. 너무 행복하고 보기만해도 좋네요."
  },
  {
    "id": 153,
    "date": "2026.06.20",
    "product": "안스리움",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "어니스트는 사랑입니다. 매번 계절소재 계절꽃을 편하게 받아볼수있어 행복합니다.정성스런 포장에 새벽배송 선물도 할수있어 좋구요. 세비아는 3월에 받은건데 아직도 몇달은 더 갈듯합니다 계속 구매 할께요"
  },
  {
    "id": 154,
    "date": "2026.06.20",
    "product": "글라디올러스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "시원해보여요. 쭈욱 뻗은 꽃대가요^^"
  },
  {
    "id": 155,
    "date": "2026.06.20",
    "product": "엔카이셔스",
    "rating": 4,
    "type": "중립",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "1미터 겨우 되는 것 같아요 풍성한 걸 부탁드렸는데 풍성은 해요.. 다만 수형이 너무 안 예쁘고 밑 부분이 풍성해서 수형 잡으려면 밑 다 쳐야 될 정도..? 잎도 마르고 상한 게 많아요"
  },
  {
    "id": 156,
    "date": "2026.06.20",
    "product": "쁘띠 수국",
    "rating": 2,
    "type": "비추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "수국 좋아해서 늘 사두는 편인데 여기선 처음 샀고 이렇게 부실하고 작은 수국은 처음.. 브로콜리인 줄 알았어요 🥹"
  },
  {
    "id": 157,
    "date": "2026.06.20",
    "product": "어텀파티 장미",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "너무 예쁜 꽃 좋은 값에 잘 받았어요. 거실에 두니 볼때마다 넘 행복해지네요. 꽃 상태도 좋고 배송포장도 공들여 해주신게 보였어요."
  },
  {
    "id": 158,
    "date": "2026.06.20",
    "product": "프릴 리시안셔스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "처음 주문해봤는데 꼼꼼히 포장 되어와서 놀랐어요 집에 꽃이 있으니 아이들도 이쁘다하고 집분위기 한껏 올라가서 좋아요~ 자주이용할께요~^^"
  },
  {
    "id": 159,
    "date": "2026.06.20",
    "product": "자리공",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "처음 주문해봤는데 꼼꼼히 포장 되어와서 놀랐어요 여름이라 몇가닥 시들한건 어쩔수 없나봐요~ 물올림해도 안되더라구요~ 집에 꽃이 있으니 아이들도 이쁘다하고 집분위기 한껏 올라가서 좋아요~ 자주이용할께요~^^"
  },
  {
    "id": 160,
    "date": "2026.06.20",
    "product": "포장 DIY 세트",
    "rating": 3,
    "type": "비추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "?? 아이보리 색화지 4장 구성이라는데..2장만왔네요;;;;"
  },
  {
    "id": 161,
    "date": "2026.06.20",
    "product": "절화수명연장제",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "좀 더 늦게 주문했으면 공짜로 받을 수 있었는데 구매했네요~ 확실히 초반에 물올림 도움되는것 같아요!"
  },
  {
    "id": 162,
    "date": "2026.06.20",
    "product": "열매 수국 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "열매가 튼실하고 싱싱하고 나무가 키가 큰 편이라서 해바라기 믹스랑 잘 어울려요"
  },
  {
    "id": 163,
    "date": "2026.06.19",
    "product": "(한정) 해바라기 에이드 믹스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "도착하자마자 바로 손질해서 물올림 중이에요. 너무 예쁘네요🫢"
  },
  {
    "id": 164,
    "date": "2026.06.19",
    "product": "프릴 리시안셔스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "오랜만에 주문했는데 꽃 신선하고 좋아요 :)"
  },
  {
    "id": 165,
    "date": "2026.06.19",
    "product": "열매 수국 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "탐스러운 해바라기와 올망졸망 열매수국 다친곳 없이 잘 도착했어요! 오랫동안 볼수 있음 좋겠네요"
  },
  {
    "id": 166,
    "date": "2026.06.19",
    "product": "플로픽 파스텔",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무너무 예뻐요 손질도 거의 된채로 와서 줄기만 좀 잘라주고 꽂아주니 물도 금방 올라옵니다.. 꽃집에서 이 가격으로 이만큼 절대 못 사는데 행복합니다 ㅠㅠ"
  },
  {
    "id": 167,
    "date": "2026.06.19",
    "product": "에포크 그린 빈티지 화병 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "잘 도착했어요 완벽한 포장으로 ㅎㅎ"
  },
  {
    "id": 168,
    "date": "2026.06.19",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "잘 받았어요~ 아이가 해바라기를 좋아해서 첫 주문 했어요 집에있는 아스파라거스와 장미를 믹스해서 꽂아봤어요 포장도 튼튼하고 해바라기도 신선하게 도착했어요"
  },
  {
    "id": 169,
    "date": "2026.06.19",
    "product": "거베라 마카롱 믹스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "안전하게 잘 도착했어요 오래가면 좋겠네요! 감사합니다."
  },
  {
    "id": 170,
    "date": "2026.06.19",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "꽃이 커서 풍성해요 색감도 발랄해서 좋아요"
  },
  {
    "id": 171,
    "date": "2026.06.19",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "집안 분위기가 환해졌어요. 맘에 들어요."
  },
  {
    "id": 172,
    "date": "2026.06.19",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "해바라기는 처음 구입했는데 이쁘고 풍성하네요"
  },
  {
    "id": 173,
    "date": "2026.06.19",
    "product": "자리공 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "해바라기가 너무 예쁘네요 바라만봐도 행복해 집니다 꼼꼼한 포장으로 안전하게 잘 받았습니다"
  },
  {
    "id": 174,
    "date": "2026.06.19",
    "product": "하이베리쿰",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "이뻐요 이뻐요 이뻐요"
  },
  {
    "id": 175,
    "date": "2026.06.19",
    "product": "보리사초 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "더워서 걱정했는데 잘 받았습니다"
  },
  {
    "id": 176,
    "date": "2026.06.19",
    "product": "파스타 거베라 외 2",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "색이 너무 오묘하고 이뻐요!"
  },
  {
    "id": 177,
    "date": "2026.06.19",
    "product": "아스틸베 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "우와 이거 저거 고르다가 눈에 띄어서 구매했는데."
  },
  {
    "id": 178,
    "date": "2026.06.19",
    "product": "알스트로메리아",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "처음 도착했을때 꽃이 좀 시들해서 걱정했는데 차가운 물 넣고 하루 지나니 다시 싱싱해 졌어요~ 지금 일주일째 인데 상태가 아주 좋은 편이에여! 노란색 덕분에 분위기도 밝아지고 꽃 보며 힐링하고 있습니다."
  },
  {
    "id": 179,
    "date": "2026.06.19",
    "product": "꽃가위",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "가위가 약간 힘이 없어보였는데 꽤 잘 잘리고 튼튼해요!"
  },
  {
    "id": 180,
    "date": "2026.06.19",
    "product": "아스크레피아스 외 1",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "생각보다 이파리가 느어무 많아서 80%정도 제거했어요. 해라기랑 너무 잘어울려요"
  },
  {
    "id": 181,
    "date": "2026.06.19",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "처음 접해보는 꽃도 있어서 좋았어요. 조금 이쉬운 점은 수국처럼 큰 화형의 꽃보다는 화형이 작고 풍성한 느낌의 꽃이 2종류정도 구성되면 좋을듯합니다. 럭키박스 XL 사이즈는 하나의 화기에 담기보단 나눠담기위해 구독하는건데 나눠담을때 큰 화형하나 있으면 초보다는 연출이 좀 어려워서요"
  },
  {
    "id": 182,
    "date": "2026.06.19",
    "product": "하이베리쿰",
    "rating": 1,
    "type": "비추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "하이베리쿰 좋아해서 여러번 구입했었는데 이건 제가 생각한 모양은 아니네요.. 재고가 부족해서 이런상품을 주셨나봅니다. 어니스트플라워 자주 이용하는디 매우 실망스럽습니다."
  },
  {
    "id": 183,
    "date": "2026.06.19",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무 이쁩니다!"
  },
  {
    "id": 184,
    "date": "2026.06.19",
    "product": "플라워 럭키박스",
    "rating": 4,
    "type": "중립",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "여름이라서 꽃이 약간 시들어서 도착할까봐 걱정했는데 싱싱하게 도착해서 그 부부는 매우 만족합니다. 근데 네이버 스마트 Store 에서 구독할 때처럼 양이 많지가 않아요..종류도 그렇고..물가가 많이 올라서일까요? 예전에는 큰 꽃병 두 개는 채우는 양이었는데 지금은 중간 거 하나의 작은 곳 2개 밖에 안 나와서 슬퍼요.."
  },
  {
    "id": 185,
    "date": "2026.06.19",
    "product": "(한정) 해바라기 에이드 믹스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "해바라기 좋아하는데 대가리가 엄청 큰 해바라기라 좋아요"
  },
  {
    "id": 186,
    "date": "2026.06.19",
    "product": "피콜리니 거베라",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "피콜리니거베라 받아서 열탕처리해서 꽂아뒀어요 랜덤색상이라 이번에는 무슨 색으로 올지 두근댑니다 저렴한 가격으로 오래 볼 수 있어서 좋아하는 꽃이에요"
  },
  {
    "id": 187,
    "date": "2026.06.19",
    "product": "엔카이셔스",
    "rating": 4,
    "type": "중립",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "엔카이셔스 수형이 예쁜걸 주문하시고 싶은 분들은 1미터짜리 대형을 사시는게 좋을것 같습니다. 저번엔 그래도 나름 예쁜 수형이 왔는데 이번에 온 친구는 팔을 휘적거리는 납작하고 애매한 수형 2개가 왔어서 수형 복불복은 정말 감안해야 할것 같습니다"
  },
  {
    "id": 188,
    "date": "2026.06.19",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "이번 꽃이 네번째 배송인데요 매번 만족하고 있습니다 특히 이번 꽃은 조합이 너무 이뻐서 보고 또보는 중이어요 제가 시장가서 꽃을 사면 이 금액으로 살 수없을텐데 대만족이어요^^"
  },
  {
    "id": 189,
    "date": "2026.06.19",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "푸릇푸릇 예뻐요. 달항아리랑 넘잘어울려요"
  },
  {
    "id": 190,
    "date": "2026.06.19",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "너무너무 이뻐요.진짜 만족하고 집안에 생기가 도는 것 같아요! 이번에도 감사합니다:)"
  },
  {
    "id": 191,
    "date": "2026.06.19",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "거실에 두니 여름 느낌 나고 싱그럽네요 늘 꽃만 보다 색다른 느낌이 드네요 좋아요 이만원대 샀는데 키크고 풍성해서 만족합니다 예뻐요"
  },
  {
    "id": 192,
    "date": "2026.06.19",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "상품구성/양",
    "department": "SCM & MD",
    "review": "키가 엄청 크지않은데도 느낌이 충분히 있고 분위기를 확 바뀌게 해줍니다 낭만적이고 여유로운 방분위기가 되었네요"
  },
  {
    "id": 193,
    "date": "2026.06.18",
    "product": "레이스플라워",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "예뻐용-!"
  },
  {
    "id": 194,
    "date": "2026.06.18",
    "product": "플라워 럭키박스",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "구성은 너무 예쁜데 날이 더워서 인지 시들한 애들이 있고 배송 문제인지 상자열자마자 3대정도 꽃봉이 떨어져왔어요ㅜㅜ 컬러감 꽃조합은 너무 예뻐요. 담번엔 날씨"
  },
  {
    "id": 195,
    "date": "2026.06.28",
    "product": "테디베어 해바라기",
    "rating": 3,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "저번에 동글동글 예쁜 아이들로 와서 또 주문했는데 이번엔….🫠 그리고 배송도 너무 아쉬웠어요ㅠㅠ 꽃 중 하나는 아예 안 꽂혀 있었어요"
  },
  {
    "id": 196,
    "date": "2026.06.18",
    "product": "플로픽 비비드",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "친구 그림 전시회에 선물했는데 우아한 느낌의 꽃다발이네요. 시간지나고 아마란서스 붉은색이 나오면 또 다른 느낌이 날듯합니다"
  },
  {
    "id": 197,
    "date": "2026.06.18",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "서비스/시스템",
    "department": "플랫폼/IT",
    "review": "리퍼브 주문해서 별로 기대 하지 않고 기다렸는데 매우 만족스러운 아이가 와서 기분이 좋아요 풍성하게 꽂는걸 좋아해서 한곳에 모았어요 다음에 또 만나고 싶네요"
  },
  {
    "id": 198,
    "date": "2026.06.18",
    "product": "조",
    "rating": 5,
    "type": "추천",
    "category": "품질/상태",
    "department": "SCM & MD",
    "review": "열매가 싱싱해요"
  },
  {
    "id": 199,
    "date": "2026.06.18",
    "product": "엔카이셔스",
    "rating": 5,
    "type": "추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "식물이 다치지 않게 꼼꼼한 포장 배송 정말 좋았구요 리퍼브 엔카이셔스지만 수형도 예쁘고 생각보다 사이즈도 커서 참 맘에들었습니다 풍성하고 싱그러운 잎이 가득한 엔카이셔스! 어디에 놓아도 정말 예쁨이 넘치네요 오자마자 물꽂이하고 거실에 넣아두니 바라만 봐도 힐링가득이예요 예쁜아이로 보내주셔서 감사해요!"
  },
  {
    "id": 200,
    "date": "2026.06.18",
    "product": "엔카이셔스+화병 세트",
    "rating": 2,
    "type": "비추천",
    "category": "배송/포장",
    "department": "SCM & CS",
    "review": "배송이 너무너무 느려서 원하는 날에 셋팅을 못해서 많이 아쉬웠어요"
  }
];

export const productStatsData: ProductStat[] = [
  {
    "product": "플라워 럭키박스",
    "totalCount": 23,
    "avgRating": 4.57,
    "recommend": 17,
    "neutral": 3,
    "notRecommend": 3,
    "recommendRate": 74
  },
  {
    "product": "(한정) 해바라기 에이드 믹스",
    "totalCount": 20,
    "avgRating": 4.5,
    "recommend": 17,
    "neutral": 0,
    "notRecommend": 3,
    "recommendRate": 85
  },
  {
    "product": "엔카이셔스",
    "totalCount": 17,
    "avgRating": 4.88,
    "recommend": 15,
    "neutral": 2,
    "notRecommend": 0,
    "recommendRate": 88
  },
  {
    "product": "자리공",
    "totalCount": 6,
    "avgRating": 3.67,
    "recommend": 4,
    "neutral": 0,
    "notRecommend": 2,
    "recommendRate": 67
  },
  {
    "product": "플로픽 비비드",
    "totalCount": 6,
    "avgRating": 4.33,
    "recommend": 4,
    "neutral": 0,
    "notRecommend": 2,
    "recommendRate": 67
  },
  {
    "product": "플로픽 파스텔",
    "totalCount": 5,
    "avgRating": 5,
    "recommend": 5,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "엔카이셔스+화병 세트",
    "totalCount": 5,
    "avgRating": 4.4,
    "recommend": 4,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 80
  },
  {
    "product": "열매 수국 외 1",
    "totalCount": 5,
    "avgRating": 4.2,
    "recommend": 4,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 80
  },
  {
    "product": "(한정) 해바라기 에이드 믹스 외 1",
    "totalCount": 4,
    "avgRating": 5,
    "recommend": 4,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "프릴 리시안셔스 외 1",
    "totalCount": 3,
    "avgRating": 5,
    "recommend": 3,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "아스크레피아스 외 1",
    "totalCount": 3,
    "avgRating": 5,
    "recommend": 3,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "쁘띠 수국 외 2",
    "totalCount": 3,
    "avgRating": 5,
    "recommend": 3,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "열매 수국",
    "totalCount": 3,
    "avgRating": 4.33,
    "recommend": 2,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 67
  },
  {
    "product": "알스트로메리아",
    "totalCount": 3,
    "avgRating": 4.33,
    "recommend": 2,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 67
  },
  {
    "product": "레몬 해바라기",
    "totalCount": 2,
    "avgRating": 5,
    "recommend": 2,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "아마란서스 외 1",
    "totalCount": 2,
    "avgRating": 5,
    "recommend": 2,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "절화수명연장제 외 1",
    "totalCount": 2,
    "avgRating": 5,
    "recommend": 2,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "페니쿰 외 1",
    "totalCount": 2,
    "avgRating": 5,
    "recommend": 2,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "트롤리우스",
    "totalCount": 2,
    "avgRating": 5,
    "recommend": 2,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "절화수명연장제",
    "totalCount": 2,
    "avgRating": 5,
    "recommend": 2,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "레이스플라워 외 1",
    "totalCount": 2,
    "avgRating": 4,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 50
  },
  {
    "product": "피콜리니 거베라",
    "totalCount": 2,
    "avgRating": 4.5,
    "recommend": 1,
    "neutral": 1,
    "notRecommend": 0,
    "recommendRate": 50
  },
  {
    "product": "거베라 마카롱 믹스",
    "totalCount": 2,
    "avgRating": 3.5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 50
  },
  {
    "product": "비스위트 장미",
    "totalCount": 2,
    "avgRating": 4.5,
    "recommend": 1,
    "neutral": 1,
    "notRecommend": 0,
    "recommendRate": 50
  },
  {
    "product": "초코 해바라기",
    "totalCount": 2,
    "avgRating": 4.5,
    "recommend": 1,
    "neutral": 1,
    "notRecommend": 0,
    "recommendRate": 50
  },
  {
    "product": "쁘띠 수국",
    "totalCount": 2,
    "avgRating": 3.5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 50
  },
  {
    "product": "하이베리쿰",
    "totalCount": 2,
    "avgRating": 3,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 50
  },
  {
    "product": "테디베어 해바라기 외 1",
    "totalCount": 2,
    "avgRating": 3.5,
    "recommend": 0,
    "neutral": 1,
    "notRecommend": 1,
    "recommendRate": 0
  },
  {
    "product": "테디베어 해바라기",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "알스트로메리아 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "플로픽 내추럴",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "샌더소니아",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "퐁퐁 국화 외 2",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "열매 너도밤나무",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "오리목",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "열매 망개",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "작약",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "글라디올러스 외 3",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "밀레니얼 핑크 장미",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "미스티블루",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "무늬 레몬트리 외 2",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "덴파레",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "초코 해바라기 외 3",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "글라디올러스 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "스프레이 델피늄 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "해바라기",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "썸머라일락 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "신지매",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "초코 코스모스",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "보리사초",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "일본 조팝나무",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "절화수명연장제 외 2",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "제네시스 믹스_06A",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "해바라기 외 2",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "오드랑트 장미 외 2",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "프릴 리시안셔스",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "아스틸베",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "(한정) 해바라기 에이드 믹스 외 8",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "드럼스틱",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "아마란서스",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "쁘띠 수국 외 3",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "루스커스",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "미니 거베라",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "라벤더 잎",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "파스타 거베라",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "오이초 외 8",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "모루 유리화기 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "작약 외 6",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "플로픽 내추럴 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "실바써니 장미",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "플로픽 비비드 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "미니 거베라 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "안스리움",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "글라디올러스",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "어텀파티 장미",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "에포크 그린 빈티지 화병 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "거베라 마카롱 믹스 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "자리공 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "보리사초 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "파스타 거베라 외 2",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "아스틸베 외 1",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "꽃가위",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "레이스플라워",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "조",
    "totalCount": 1,
    "avgRating": 5,
    "recommend": 1,
    "neutral": 0,
    "notRecommend": 0,
    "recommendRate": 100
  },
  {
    "product": "홍화",
    "totalCount": 1,
    "avgRating": 4,
    "recommend": 0,
    "neutral": 1,
    "notRecommend": 0,
    "recommendRate": 0
  },
  {
    "product": "금꿩의 다리",
    "totalCount": 1,
    "avgRating": 4,
    "recommend": 0,
    "neutral": 1,
    "notRecommend": 0,
    "recommendRate": 0
  },
  {
    "product": "자이언트 델피늄",
    "totalCount": 1,
    "avgRating": 1,
    "recommend": 0,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 0
  },
  {
    "product": "자이언트 델피늄 외 1",
    "totalCount": 1,
    "avgRating": 3,
    "recommend": 0,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 0
  },
  {
    "product": "페니쿰 외 3",
    "totalCount": 1,
    "avgRating": 4,
    "recommend": 0,
    "neutral": 1,
    "notRecommend": 0,
    "recommendRate": 0
  },
  {
    "product": "수국 컬러믹스",
    "totalCount": 1,
    "avgRating": 4,
    "recommend": 0,
    "neutral": 1,
    "notRecommend": 0,
    "recommendRate": 0
  },
  {
    "product": "쉼머 장미 외 2",
    "totalCount": 1,
    "avgRating": 4,
    "recommend": 0,
    "neutral": 1,
    "notRecommend": 0,
    "recommendRate": 0
  },
  {
    "product": "(한정) 장미 랜덤박스",
    "totalCount": 1,
    "avgRating": 1,
    "recommend": 0,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 0
  },
  {
    "product": "자리공 외 2",
    "totalCount": 1,
    "avgRating": 3,
    "recommend": 0,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 0
  },
  {
    "product": "포장 DIY 세트",
    "totalCount": 1,
    "avgRating": 3,
    "recommend": 0,
    "neutral": 0,
    "notRecommend": 1,
    "recommendRate": 0
  }
];
