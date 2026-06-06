interface RankMedalProps {
  rank: number;
}

export default function RankMedal({ rank }: RankMedalProps) {
  if (rank <= 3) {
    return (
      <span className={`rank-medal rank-medal--${rank}`}>
        {rank}
      </span>
    );
  }
  return <span className="rank-text">{rank}</span>;
}
