import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Shield, Users, Coins, Palette, Globe, Rocket } from 'lucide-react';

const About = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Coins,
      title: 'Thanh toán bằng tiền số',
      description: 'Hỗ trợ F.U. Money, Camly Coin và nhiều loại crypto khác để giao dịch an toàn, nhanh chóng và minh bạch.',
      color: 'from-yellow-400 to-orange-500'
    },
    {
      icon: Shield,
      title: 'Hồ sơ Web3 vĩnh viễn',
      description: 'Thông tin cá nhân được lưu trữ trên blockchain, đảm bảo tính bất biến và bảo mật cao.',
      color: 'from-blue-400 to-cyan-500'
    },
    {
      icon: Palette,
      title: 'Tạo và giao dịch NFT',
      description: 'Biến tài liệu, tác phẩm nghệ thuật, video, hình ảnh thành NFT có giá trị.',
      color: 'from-purple-400 to-pink-500'
    },
    {
      icon: Sparkles,
      title: 'Tích hợp AI',
      description: 'Công cụ AI hàng đầu giúp sáng tạo bất kỳ sản phẩm kỹ thuật số nào.',
      color: 'from-green-400 to-emerald-500'
    },
    {
      icon: Globe,
      title: 'Kết nối toàn cầu',
      description: 'Giúp doanh nhân, chuyên gia, nhà đầu tư trên thế giới dễ dàng tìm thấy nhau.',
      color: 'from-indigo-400 to-violet-500'
    },
    {
      icon: Rocket,
      title: 'Phát triển sự nghiệp',
      description: 'Công cụ xây dựng thương hiệu cá nhân, kết nối đối tác và mở rộng kinh doanh.',
      color: 'from-red-400 to-rose-500'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-20 lg:pb-0">
      <FacebookNavbar />
      <main className="pt-14">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary via-primary/90 to-gold py-16">
          <div className="max-w-5xl mx-auto px-4 text-center text-white">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <img 
                src="/fun-profile-logo-40.webp" 
                alt="FUN Profile" 
                width={80}
                height={80}
                className="w-20 h-20 rounded-full"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">FUN Profile</h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8">
              Mạng Xã Hội Web3 Kết Hợp AI
            </p>
            <p className="text-lg text-white/80 max-w-2xl mx-auto">
              Biến Mọi Thứ Thành Tài Sản Số - Nơi giá trị cá nhân và tài sản trí tuệ được tối ưu hóa và bảo vệ mãi mãi.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>

          {/* Introduction */}
          <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Giới thiệu
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              F.U. Profile là một mạng xã hội Web3 và còn là một nền tảng sáng tạo, lưu trữ và giao dịch tài sản số phi tập trung, nơi mọi thông tin, tài sản kỹ thuật số và giá trị cá nhân được bảo toàn vĩnh viễn trên blockchain.
            </p>
          </div>

          {/* Features Grid */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-center">🔥 Tính năng nổi bật</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Vision */}
          <div className="bg-gradient-to-r from-primary/10 to-gold/10 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Tầm nhìn</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Với F.U. Profile, bạn không chỉ tham gia một mạng xã hội Web3, mà còn bước vào một không gian số thông minh, nơi AI và blockchain kết hợp để biến mọi ý tưởng thành tài sản thực sự. Đây chính là tương lai của mạng xã hội.
            </p>
            <Button 
              className="mt-6 bg-primary hover:bg-primary/90"
              onClick={() => navigate('/')}
            >
              Khám phá ngay
            </Button>
          </div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
};

export default About;
