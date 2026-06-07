/**
 * RegulationFocus — show the controlled vocabulary of regulation focus
 * points (28 items across 9 categories). Used during human review to
 * align the LLM's extracted categories with the gold taxonomy.
 */
import { useEffect, useState } from 'react';
import { Card, Col, Empty, Input, Row, Spin, Tag } from 'antd';
import { BookOutlined, SearchOutlined } from '@ant-design/icons';
import PageTitle from '../components/PageTitle';
import { getRegulationFocusVocab } from '../api/client';
import type { RegulationFocusVocab } from '../types';

const CATEGORY_COLOR: Record<string, string> = {
  '财务异常': 'red',
  '信息披露': 'orange',
  '关联交易': 'gold',
  '公司治理': 'purple',
  '经营合理性': 'blue',
  '并购重组': 'geekblue',
  '担保事项': 'magenta',
  '再融资': 'cyan',
  '会计处理': 'volcano',
};

export default function RegulationFocus() {
  const [data, setData] = useState<RegulationFocusVocab | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getRegulationFocusVocab()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const filtered = (data?.vocab ?? []).filter((fp) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      fp.category.toLowerCase().includes(s)
      || fp.subcategory.toLowerCase().includes(s)
      || fp.description.toLowerCase().includes(s)
    );
  });

  const grouped: Record<string, typeof filtered> = {};
  for (const fp of filtered) {
    grouped[fp.category] ??= [];
    grouped[fp.category].push(fp);
  }

  return (
    <Spin spinning={loading}>
      <div className="page-container fade-in">
        <PageTitle title="监管关注点词表" />

        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <BookOutlined style={{ fontSize: 18, color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-normal)' }}>
              共 <b>{data?.vocab.length ?? 0}</b> 项受控关注点，覆盖 <b>{data?.categories.length ?? 0}</b> 大类。
              赛题分类准确率目标 ≥ 80%。
            </span>
            <Input.Search
              placeholder="搜索关键词、类别"
              prefix={<SearchOutlined />}
              style={{ marginLeft: 'auto', width: 280 }}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </div>
        </Card>

        {filtered.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配的关注点" />
        )}

        {Object.entries(grouped).map(([category, items]) => (
          <Card
            key={category}
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color={CATEGORY_COLOR[category] ?? 'blue'} style={{ fontWeight: 600, fontSize: 13 }}>
                  {category}
                </Tag>
                <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                  共 {items.length} 项
                </span>
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 16]}>
              {items.map((fp) => (
                <Col xs={24} sm={12} lg={8} key={fp.subcategory}>
                  <Card
                    size="small"
                    style={{ height: '100%' }}
                    styles={{ body: { padding: 14 } }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-bright)', marginBottom: 6 }}>
                      {fp.subcategory}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-normal)', lineHeight: 1.6 }}>
                      {fp.description}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        ))}
      </div>
    </Spin>
  );
}
